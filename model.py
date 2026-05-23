import torch
import torch.nn as nn
import torch.nn.functional as F

class SpectralAnomalyProcessor(nn.Module):
    """
    CNN module specifically tuned to detect periodic high-frequency noise checkerboard 
    anomalies in Discrete Fourier Transform maps caused by AI upsampling layers.
    """
    def __init__(self):
        super(SpectralAnomalyProcessor, self).__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 16, kernel_size=3, stride=2, padding=1), # Output: 16x128x128
            nn.BatchNorm2d(16),
            nn.SiLU(),
            nn.Conv2d(16, 32, kernel_size=3, stride=2, padding=1), # Output: 32x64x64
            nn.BatchNorm2d(32),
            nn.SiLU(),
            nn.Conv2d(32, 64, kernel_size=3, stride=2, padding=1), # Output: 64x32x32
            nn.BatchNorm2d(64),
            nn.SiLU(),
            nn.AdaptiveAvgPool2d((4, 4)) # Output: 64x4x4 (1024 features)
        )
        self.fc = nn.Sequential(
            nn.Linear(1024, 256),
            nn.SiLU(),
            nn.Dropout(0.3)
        )

    def forward(self, fft_map):
        x = self.features(fft_map)
        x = x.view(x.size(0), -1)
        return self.fc(x)


class VisualAttentionBlock(nn.Module):
    """
    Vision Transformer Self-Attention block configured to model non-Euclidean lighting
    vector misalignments and global scene integrity breaches.
    """
    def __init__(self, embed_dim, num_heads=8):
        super(VisualAttentionBlock, self).__init__()
        self.attention = nn.MultiheadAttention(embed_dim, num_heads, dropout=0.1, batch_first=True)
        self.norm1 = nn.LayerNorm(embed_dim)
        self.norm2 = nn.LayerNorm(embed_dim)
        self.mlp = nn.Sequential(
            nn.Linear(embed_dim, embed_dim * 4),
            nn.SiLU(),
            nn.Linear(embed_dim * 4, embed_dim),
            nn.Dropout(0.1)
        )

    def forward(self, x):
        # x shape: [Batch, Tokens, EmbedDim]
        attn_out, _ = self.attention(x, x, x)
        x = self.norm1(x + attn_out)
        mlp_out = self.mlp(x)
        x = self.norm2(x + mlp_out)
        return x


class ForensicEnsembleModel(nn.Module):
    """
    Consolidated Forensic Ensemble Neural Architecture.
    Combines:
     - Spatial CNN for localized facial blending, skin texture, and edge transitions.
     - Spectral Processor for frequency FFT artifact analysis.
     - Vision Transformer block for global context validation.
     - Video Sequence Gated Recurrent Block (Temporal Analysis) to detect temporal jitter/facial flicker.
    """
    def __init__(self, embed_dim=512, feature_map_size=7, is_video=False):
        super(ForensicEnsembleModel, self).__init__()
        self.is_video = is_video
        
        # Spatial CNN Convolution blocks (Backbone representing ResNet / EfficientNet feature layers)
        self.spatial_cnn = nn.Sequential(
            nn.Conv2d(3, 64, kernel_size=7, stride=2, padding=3, bias=False),
            nn.BatchNorm2d(64),
            nn.SiLU(),
            nn.MaxPool2d(kernel_size=3, stride=2, padding=1),
            
            # Efficient block layers
            nn.Conv2d(64, 128, kernel_size=3, stride=2, padding=1, groups=64),
            nn.Conv2d(128, 256, kernel_size=1),
            nn.BatchNorm2d(256),
            nn.SiLU(),
            
            nn.Conv2d(256, 512, kernel_size=3, stride=2, padding=1, groups=256),
            nn.Conv2d(512, embed_dim, kernel_size=1),
            nn.BatchNorm2d(embed_dim),
            nn.SiLU(),
            
            nn.AdaptiveAvgPool2d((feature_map_size, feature_map_size)) # Outputs [Batch, 512, 7, 7]
        )
        
        # Spectral frequency processor
        self.spectral_processor = SpectralAnomalyProcessor()
        
        # Merge layer bridging spatial (512) + spectral (256) outputs
        self.fusion_projection = nn.Linear(embed_dim + 256, embed_dim)
        
        # Vision Transformer block
        self.transformer_attention = VisualAttentionBlock(embed_dim=embed_dim)
        
        # Video Temporal Module (GRU) for sequence level deepfake and facial mismatch processing
        if self.is_video:
            self.temporal_recurrent = nn.GRU(
                input_size=embed_dim,
                hidden_size=256,
                num_layers=2,
                batch_first=True,
                bidirectional=True
            )
            classifier_in = 512 # Bidirectional 256 + 256
        else:
            classifier_in = embed_dim

        # Multi-task Classification & Estimation Heads
        self.ai_synthesis_head = nn.Sequential(
            nn.Linear(classifier_in, 128),
            nn.SiLU(),
            nn.Dropout(0.4),
            nn.Linear(128, 1) # Probability score [0, 1] (GAN / Diffusion classification logits)
        )
        
        self.deepfake_head = nn.Sequential(
            nn.Linear(classifier_in, 128),
            nn.SiLU(),
            nn.Dropout(0.4),
            nn.Linear(128, 1) # Deepfake warping classification logits
        )
        
        # Pixel Manipulation Heatmap localization grid projector (Output: 16x16 resolution grid)
        self.heatmap_generator = nn.Sequential(
            nn.Conv2d(embed_dim, 256, kernel_size=3, padding=1),
            nn.BatchNorm2d(256),
            nn.SiLU(),
            nn.Conv2d(256, 1, kernel_size=1), # Output 1 channel heat map
            nn.AdaptiveAvgPool2d((16, 16))
        )

    def extract_single_frame_features(self, rgb_tensor, fft_tensor):
        # rgb_tensor shape: [Batch, 3, 224, 224]
        spatial_features = self.spatial_cnn(rgb_tensor) # [Batch, 512, 7, 7]
        
        # Generate spatial correlation feature grid (used to compute manipulation map)
        heatmap_logits = self.heatmap_generator(spatial_features) # [Batch, 1, 16, 16]
        
        # Global pooling spatial features down
        spatial_pooled = F.adaptive_avg_pool2d(spatial_features, (1, 1)).view(spatial_features.size(0), -1) # [Batch, 512]
        
        # Get spectral signatures
        spectral_pooled = self.spectral_processor(fft_tensor) # [Batch, 256]
        
        # Concat and project
        fused = torch.cat([spatial_pooled, spectral_pooled], dim=1) # [Batch, 768]
        projected = self.fusion_projection(fused)                     # [Batch, 512]
        
        # Reshape to sequence tokens list for Transformer validation (e.g. [Batch, 1 token, embed_dim])
        tokens = projected.unsqueeze(1)
        transformer_out = self.transformer_attention(tokens)
        final_token = transformer_out.squeeze(1) # [Batch, 512]
        
        return final_token, heatmap_logits

    def forward(self, x, fft):
        # x coordinate handles [Batch, Channel, H, W] for images OR [Batch, Frames, Channel, H, W] for video streams
        if self.is_video:
            batch_size, num_frames, channels, h, w = x.shape
            _, _, fft_channels, fft_h, fft_w = fft.shape
            
            # Reshape inputs to batch-flattened structures to carry out high-speed 2D parallel processing
            fb_x = x.view(batch_size * num_frames, channels, h, w)
            fb_fft = fft.view(batch_size * num_frames, fft_channels, fft_h, fft_w)
            
            frame_features, frame_heatmaps = self.extract_single_frame_features(fb_x, fb_fft)
            
            # Reconstruct sequence temporal shape representation
            seq_features = frame_features.view(batch_size, num_frames, -1) # [Batch, Frames, 512]
            heatmap_grid = frame_heatmaps.view(batch_size, num_frames, 1, 16, 16)
            
            # Recurrent Temporal sequence computation
            temporal_out, _ = self.temporal_recurrent(seq_features) # [Batch, Frames, 512]
            
            # Extract final temporal frame sequence representation
            final_features = temporal_out[:, -1, :] # [Batch, 512]
            
            # Average heatmaps across timeline as overall layout artifact heatmap representation
            heatmap_out = torch.mean(heatmap_grid, dim=1).squeeze(1) # [Batch, 16, 16]
        else:
            final_features, heatmap_logits = self.extract_single_frame_features(x, fft)
            heatmap_out = heatmap_logits.squeeze(1) # [Batch, 16, 16]

        # Classification task logits
        ai_synth_logits = self.ai_synthesis_head(final_features)
        deepfake_logits = self.deepfake_head(final_features)
        
        # Soft sigmoid activations to construct calibrated output confidence margins
        ai_prob = torch.sigmoid(ai_synth_logits)
        deepfake_prob = torch.sigmoid(deepfake_logits)
        heatmap_map = torch.sigmoid(heatmap_out)
        
        return {
            "aiProbability": ai_prob.squeeze(-1),
            "deepfakeProbability": deepfake_prob.squeeze(-1),
            "heatmap": heatmap_map
        }
