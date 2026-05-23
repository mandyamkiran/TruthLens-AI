import os
import cv2
import numpy as np
import torch
from torch.utils.data import Dataset
from PIL import Image

class ForensicDataset(Dataset):
    """
    Enterprise-grade Forensic Media Dataset for training high-accuracy deepfake/synthesis detection.
    Preprocesses raw inputs, performs Fast Fourier Transform (FFT) to capture high-frequency 
    spectral signatures (GAN checkerboard artifacts/latent diffusion grids), and runs custom
    compression, noise, and blur augmentations.
    """
    def __init__(self, data_dir, labels_dict, transform=None, is_video=False, frame_sample_rate=5):
        """
        Args:
            data_dir (str): Root path to media directories.
            labels_dict (dict): Dictionary mapping file names/keys to classification targets (0 = Real, 1 = Synth/Deepfake).
            transform (callable, optional): PyTorch or torchvision visual transforms.
            is_video (bool): True if handling multi-frame temporal video sequences (Celeb-DF, DFDC).
            frame_sample_rate (int): Number of frames to sample sequentially for video sequences.
        """
        self.data_dir = data_dir
        self.labels_dict = labels_dict
        self.file_list = list(labels_dict.keys())
        self.transform = transform
        self.is_video = is_video
        self.frame_sample_rate = frame_sample_rate

    def __len__(self):
        return len(self.file_list)

    def extract_fft_spectrum(self, img_gray):
        """
        Computes 2D Fast Fourier Transform to extract frequency spectrum signatures.
        GAN/Diffusion generators leave unique periodic high-frequency noise fingerprints in backprop coordinates.
        """
        # Calculate 2D Discrete Fourier Transform
        dft = cv2.dft(np.float32(img_gray), flags=cv2.DFT_COMPLEX_OUTPUT)
        dft_shift = np.fft.fftshift(dft)
        
        # Calculate magnitude spectrum and transform to log-scale
        magnitude = 20 * np.log(cv2.magnitude(dft_shift[:, :, 0], dft_shift[:, :, 1]) + 1e-8)
        
        # Normalize to [0, 1] range
        magnitude = (magnitude - np.min(magnitude)) / (np.max(magnitude) - np.min(magnitude) + 1e-8)
        return magnitude

    def apply_compression_simulation(self, img):
        """
        Simulates adversarial JPEG compression pipelines (common in social media sharing like Discord/Twitter)
        to train the neural classifier to remain robust against stripped or compressed media markers.
        """
        quality = np.random.randint(45, 95)
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
        result, encimg = cv2.imencode('.jpg', img, encode_param)
        if result:
            img = cv2.imdecode(encimg, 1)
        return img

    def apply_sensor_noise_variation(self, img):
        """
        Applies varying Gaussian, Speckle, and Salt-and-Pepper noise parameters 
        to challenge the sensor's PRNU (Photo Response Non-Uniformity) validation modules.
        """
        h, w, c = img.shape
        noise_type = np.random.choice(['gaussian', 'speckle', 'none'])
        if noise_type == 'gaussian':
            mean = 0
            var = np.random.uniform(1e-4, 5e-3)
            sigma = var ** 0.5
            gauss = np.random.normal(mean, sigma, (h, w, c)) * 255
            img = np.clip(img + gauss, 0, 255).astype(np.uint8)
        elif noise_type == 'speckle':
            noise = np.random.randn(h, w, c) * 0.05
            img = np.clip(img + img * noise, 0, 255).astype(np.uint8)
        return img

    def preprocess_image(self, file_path):
        # Load image via OpenCV (BGR)
        img = cv2.imread(file_path)
        if img is None:
            raise FileNotFoundError(f"Failed to load image: {file_path}")
            
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Random augmentations simulating compression/resolution-drops during optimization studies
        if np.random.rand() < 0.6:
            img = self.apply_compression_simulation(img)
        if np.random.rand() < 0.4:
            img = self.apply_sensor_noise_variation(img)
            
        # Gray channel extraction for frequency maps
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
        gray_resized = cv2.resize(gray, (256, 256))
        fft_spectrum = self.extract_fft_spectrum(gray_resized)
        
        # Normalize features
        if self.transform:
            # Convert to PIL for typical PyTorch ImageNet transforms
            pil_img = Image.fromarray(img)
            img_tensor = self.transform(pil_img)
        else:
            # Default fallback tensor conversion
            img_tensor = torch.tensor(img, dtype=torch.float32).permute(2, 0, 1) / 255.0
            
        fft_tensor = torch.tensor(fft_spectrum, dtype=torch.float32).unsqueeze(0) # [1, 256, 256]
        return img_tensor, fft_tensor

    def preprocess_video(self, file_path):
        """
        Reads, extracts frames and computes sequential temporal alignments
        to detect temporal artifacts, facial flickering, and lip-sync inconsistencies.
        """
        cap = cv2.VideoCapture(file_path)
        if not cap.isOpened():
            raise FileNotFoundError(f"Unable to decode video streams: {file_path}")
            
        frames = []
        fft_frames = []
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Calculate indices to sample frame-rate evenly across sequence
        indices = np.linspace(0, total_frames - 1, self.frame_sample_rate, dtype=int)
        
        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if not ret:
                break
                
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
            gray_res = cv2.resize(gray, (256, 256))
            fft_spect = self.extract_fft_spectrum(gray_res)
            
            if self.transform:
                pil_f = Image.fromarray(frame)
                f_tensor = self.transform(pil_f)
            else:
                f_tensor = torch.tensor(frame, dtype=torch.float32).permute(2, 0, 1) / 255.0
                
            frames.append(f_tensor.unsqueeze(0))
            fft_frames.append(torch.tensor(fft_spect, dtype=torch.float32).unsqueeze(0).unsqueeze(0))
            
        cap.release()
        
        # Pad sequence if short to maintain model dimension shape properties
        while len(frames) < self.frame_sample_rate:
            if len(frames) == 0:
                # Fallback blank frame tensors
                frames.append(torch.zeros((1, 3, 224, 224)))
                fft_frames.append(torch.zeros((1, 1, 256, 256)))
            else:
                frames.append(frames[-1])
                fft_frames.append(fft_frames[-1])
                
        # Stack sequences along time dimension
        seq_tensor = torch.cat(frames, dim=0)    # [SampleRate, Channels, H, W]
        fft_seq_tensor = torch.cat(fft_frames, dim=0) # [SampleRate, 1, 256, 256]
        
        return seq_tensor, fft_seq_tensor

    def __getitem__(self, idx):
        file_name = self.file_list[idx]
        file_path = os.path.join(self.data_dir, file_name)
        label = float(self.labels_dict[file_name])
        
        try:
            if self.is_video:
                media_tensor, fft_tensor = self.preprocess_video(file_path)
            else:
                media_tensor, fft_tensor = self.preprocess_image(file_path)
        except Exception as e:
            # Safe training fallback: emit tensor zero-block on file error to avoid breaking runtime loops
            print(f"Error processing {file_path}: {e}")
            if self.is_video:
                media_tensor = torch.zeros((self.frame_sample_rate, 3, 224, 224))
                fft_tensor = torch.zeros((self.frame_sample_rate, 1, 256, 256))
            else:
                media_tensor = torch.zeros((3, 224, 224))
                fft_tensor = torch.zeros((1, 256, 256))
                
        return media_tensor, fft_tensor, torch.tensor(label, dtype=torch.float32)
