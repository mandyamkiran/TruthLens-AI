import os
import time
import argparse
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, random_split
from torch.cuda.amp import GradScaler, autocast
from torchvision import transforms

from dataset import ForensicDataset
from model import ForensicEnsembleModel

def calculate_metrics(preds, targets):
    """
    Computes professional enterprise evaluations for forensic audit reporting.
    Calculates Accuracy, Precision, Recall, F1 Score, and false alarm thresholds (EER).
    """
    preds_binary = (preds >= 0.5).astype(np.float32)
    
    tp = np.sum((preds_binary == 1) & (targets == 1))
    fp = np.sum((preds_binary == 1) & (targets == 0))
    fn = np.sum((preds_binary == 0) & (targets == 1))
    tn = np.sum((preds_binary == 0) & (targets == 0))
    
    accuracy = (tp + tn) / (tp + fp + fn + tn + 1e-8)
    precision = tp / (tp + fp + 1e-8)
    recall = tp / (tp + fn + 1e-8)
    f1_score = 2 * (precision * recall) / (precision + recall + 1e-8)
    
    # Simple EER (Equal Error Rate) calculation
    # Sort predictions to adjust threshold
    thresholds = np.linspace(0.0, 1.0, 100)
    frr = []
    far = []
    for t in thresholds:
        t_preds = (preds >= t).astype(np.float32)
        fn_t = np.sum((t_preds == 0) & (targets == 1))
        tp_t = np.sum((t_preds == 1) & (targets == 1))
        fp_t = np.sum((t_preds == 1) & (targets == 0))
        tn_t = np.sum((t_preds == 0) & (targets == 0))
        
        frr_val = fn_t / (tp_t + fn_t + 1e-8)
        far_val = fp_t / (fp_t + tn_t + 1e-8)
        frr.append(frr_val)
        far.append(far_val)
        
    diffs = np.abs(np.array(frr) - np.array(far))
    eer = frr[np.argmin(diffs)]
    
    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1_score,
        "eer": eer
    }

def train_pipeline(data_dir, batch_size=16, epochs=25, lr=2e-4, is_video=False, checkpoint_dir="./checkpoints"):
    os.makedirs(checkpoint_dir, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Executing Forensic Pipeline with target accelerator: {device}")

    # Enterprise ImageNet standard normalizations to align with pre-trained backbones
    transform_pipeline = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.ColorJitter(brightness=0.1, contrast=0.1, saturation=0.1),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])

    # Sample standard training database setup
    # In practice, these point to actual massive sets (Celeb-DF, DFDC datasets)
    sample_labels = {}
    if os.path.exists(data_dir):
        files = [f for f in os.listdir(data_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.mp4', '.avi', '.mov'))]
        for f in files:
            # Simple metadata label extractor (supports structured loading schemes)
            sample_labels[f] = 1.0 if 'fake' in f.lower() or 'synth' in f.lower() else 0.0
    else:
        # Generate absolute fallback structure representing empty database validation
        print(f"Warning: Target source folder '{data_dir}' not detected or empty. Prepopulating synthetic keys metadata maps.")
        for i in range(100):
            sample_labels[f"synthetic_generator_sample_{i}.jpg"] = 1.0 if i % 2 == 0 else 0.0

    dataset = ForensicDataset(data_dir=data_dir, labels_dict=sample_labels, transform=transform_pipeline, is_video=is_video)
    
    # Split train and validation (80-20 partition split)
    val_size = int(len(dataset) * 0.2)
    train_size = len(dataset) - val_size
    train_subset, val_subset = random_split(dataset, [train_size, val_size])

    train_loader = DataLoader(train_subset, batch_size=batch_size, shuffle=True, num_workers=2, drop_last=True)
    val_loader = DataLoader(val_subset, batch_size=batch_size, shuffle=False, num_workers=2)

    # Initialize model assembly
    model = ForensicEnsembleModel(is_video=is_video)
    model.to(device)

    # Multi-task criteria weight distributions
    classification_loss_fn = nn.BCELoss()
    spatial_reconstruction_loss_fn = nn.MSELoss() # Maps spatial anomaly masks on the heatmap regression grid

    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)
    
    # Dynamic FP16 Gradient Scaler supporting automatic mixed precision training (AMP)
    scaler = GradScaler(enabled=(device.type == 'cuda'))

    best_val_loss = float('inf')
    early_stop_patience = 5
    epochs_no_improve = 0

    print("--- MODEL TRAINING STAGE INITIALIZED ---")
    start_time = time.time()
    
    for epoch in range(1, epochs + 1):
        model.train()
        train_running_loss = 0.0
        train_running_ai_loss = 0.0
        train_running_df_loss = 0.0
        
        for batch_idx, (rgb, fft, labels) in enumerate(train_loader):
            rgb, fft, labels = rgb.to(device), fft.to(device), labels.to(device)
            optimizer.zero_grad()

            with autocast(enabled=(device.type == 'cuda')):
                outputs = model(rgb, fft)
                
                # Dynamic loss formulation: Target synthesis probability + Deepfake verification limits
                loss_ai = classification_loss_fn(outputs["aiProbability"], labels)
                loss_df = classification_loss_fn(outputs["deepfakeProbability"], labels)
                
                # Average combination of target classification losses
                total_loss = (loss_ai * 0.6) + (loss_df * 0.4)

            # Gradient Step using AMP
            scaler.scale(total_loss).backward()
            scaler.step(optimizer)
            scaler.update()

            train_running_loss += total_loss.item()
            train_running_ai_loss += loss_ai.item()
            train_running_df_loss += loss_df.item()

        epoch_train_loss = train_running_loss / len(train_loader)
        epoch_train_ai = train_running_ai_loss / len(train_loader)
        epoch_train_df = train_running_df_loss / len(train_loader)

        # Validation round
        model.eval()
        val_running_loss = 0.0
        all_val_preds = []
        all_val_targets = []

        with torch.no_grad():
            for rgb, fft, labels in val_loader:
                rgb, fft, labels = rgb.to(device), fft.to(device), labels.to(device)
                
                with autocast(enabled=(device.type == 'cuda')):
                    outputs = model(rgb, fft)
                    loss_ai = classification_loss_fn(outputs["aiProbability"], labels)
                    loss_df = classification_loss_fn(outputs["deepfakeProbability"], labels)
                    val_loss = (loss_ai * 0.6) + (loss_df * 0.4)

                val_running_loss += val_loss.item()
                all_val_preds.extend(outputs["aiProbability"].cpu().numpy())
                all_val_targets.extend(labels.cpu().numpy())

        epoch_val_loss = val_running_loss / len(val_loader)
        scheduler.step()

        # Compute precision-recall indicators
        val_metrics = calculate_metrics(np.array(all_val_preds), np.array(all_val_targets))

        print(f"Epoch {epoch}/{epochs} | Train Loss: {epoch_train_loss:.4f} (AI: {epoch_train_ai:.4f}/DF: {epoch_train_df:.4f}) | "
              f"Val Loss: {epoch_val_loss:.4f} | Val Accuracy: {val_metrics['accuracy']:.4f} (EER: {val_metrics['eer']:.4f})")

        # Save weights and execute early stopping safeguards
        if epoch_val_loss < best_val_loss:
            best_val_loss = epoch_val_loss
            epochs_no_improve = 0
            best_checkpoint_path = os.path.join(checkpoint_dir, "forensics_ensemble_opt.pth")
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'metrics': val_metrics,
                'val_loss': epoch_val_loss
            }, best_checkpoint_path)
            print(f"--> Saved pristine structural model configuration model weights at: {best_checkpoint_path}")
        else:
            epochs_no_improve += 1
            if epochs_no_improve >= early_stop_patience:
                print(f"Early halting procedure triggered. Model generalization criteria met at epoch {epoch}.")
                break

    duration = time.time() - start_time
    print(f"--- TRAINING COMPLETED IN {duration:.2f}s | Enterprise Optimal Model Saved with Accuracy: {val_metrics['accuracy'] * 100:.2f}% | EER: {val_metrics['eer'] * 100:.2f}% ---")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pristine ML model Training Pipeline")
    parser.add_argument("--data_dir", type=str, default="./raw_dataset", help="Target dataset image source directories")
    parser.add_argument("--batch_size", type=int, default=16, help="Batch items per processor pass")
    parser.add_argument("--epochs", type=int, default=15, help="Total dataset passes")
    parser.add_argument("--lr", type=float, default=2e-4, help="Adam backpropagation step rate")
    parser.add_argument("--video", action="store_true", help="Set to train sequential video sequence models")
    
    args = parser.parse_args()
    train_pipeline(data_dir=args.data_dir, batch_size=args.batch_size, epochs=args.epochs, lr=args.lr, is_video=args.video)
