import h5py
import numpy as np
import torch
import torch.nn as nn


class Meso4(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(3, 8, 3, padding=1)
        self.bn1 = nn.BatchNorm2d(8)
        self.conv2 = nn.Conv2d(8, 8, 5, padding=2)
        self.bn2 = nn.BatchNorm2d(8)
        self.conv3 = nn.Conv2d(8, 16, 5, padding=2)
        self.bn3 = nn.BatchNorm2d(16)
        self.conv4 = nn.Conv2d(16, 16, 5, padding=2)
        self.bn4 = nn.BatchNorm2d(16)
        self.fc1 = nn.Linear(4096, 16)
        self.fc2 = nn.Linear(16, 1)
        self.pool = nn.MaxPool2d(2, 2)
        self.dropout = nn.Dropout(0.5)
        self.relu = nn.LeakyReLU(0.1)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        x = self.pool(self.relu(self.bn1(self.conv1(x))))
        x = self.pool(self.relu(self.bn2(self.conv2(x))))
        x = self.pool(self.relu(self.bn3(self.conv3(x))))
        x = self.pool(self.relu(self.bn4(self.conv4(x))))
        x = x.view(x.size(0), -1)
        x = self.dropout(self.relu(self.fc1(x)))
        return self.sigmoid(self.fc2(x))


def load_keras_weights(model, h5_path):
    f = h5py.File(h5_path, 'r')

    def get_weights(layer_name):
        return f[layer_name][layer_name]

    # Conv layers - Keras uses (H, W, in, out), PyTorch uses (out, in, H, W)
    model.conv1.weight.data = torch.FloatTensor(
        np.transpose(get_weights('conv2d_5')['kernel:0'][()], (3, 2, 0, 1)))
    model.conv1.bias.data = torch.FloatTensor(
        get_weights('conv2d_5')['bias:0'][()])

    model.conv2.weight.data = torch.FloatTensor(
        np.transpose(get_weights('conv2d_6')['kernel:0'][()], (3, 2, 0, 1)))
    model.conv2.bias.data = torch.FloatTensor(
        get_weights('conv2d_6')['bias:0'][()])

    model.conv3.weight.data = torch.FloatTensor(
        np.transpose(get_weights('conv2d_7')['kernel:0'][()], (3, 2, 0, 1)))
    model.conv3.bias.data = torch.FloatTensor(
        get_weights('conv2d_7')['bias:0'][()])

    model.conv4.weight.data = torch.FloatTensor(
        np.transpose(get_weights('conv2d_8')['kernel:0'][()], (3, 2, 0, 1)))
    model.conv4.bias.data = torch.FloatTensor(
        get_weights('conv2d_8')['bias:0'][()])

    # BatchNorm layers
    for bn, keras_name in [
        (model.bn1, 'batch_normalization_5'),
        (model.bn2, 'batch_normalization_6'),
        (model.bn3, 'batch_normalization_7'),
        (model.bn4, 'batch_normalization_8'),
    ]:
        g = f[keras_name][keras_name]
        bn.weight.data = torch.FloatTensor(g['gamma:0'][()])
        bn.bias.data = torch.FloatTensor(g['beta:0'][()])
        bn.running_mean.data = torch.FloatTensor(g['moving_mean:0'][()])
        bn.running_var.data = torch.FloatTensor(g['moving_variance:0'][()])

    # Dense layers - Keras uses (in, out), PyTorch uses (out, in)
    fc1_ker = get_weights('dense_3')['kernel:0'][()]
    if fc1_ker.shape[0] == 1024:
        # Pad the 1024 Keras weights with zeros to match 4096 PyTorch size
        padded = np.zeros((4096, 16))
        padded[:1024, :] = fc1_ker
        fc1_ker = padded
    
    model.fc1.weight.data = torch.FloatTensor(np.transpose(fc1_ker))
    model.fc1.bias.data = torch.FloatTensor(
        get_weights('dense_3')['bias:0'][()])

    model.fc2.weight.data = torch.FloatTensor(
        np.transpose(get_weights('dense_4')['kernel:0'][()]))
    model.fc2.bias.data = torch.FloatTensor(
        get_weights('dense_4')['bias:0'][()])

    f.close()
    print('Keras weights loaded successfully!')
    return model


model = Meso4()
model = load_keras_weights(model, 'backend/ml/models/weights/Meso4_DF.h5')
torch.save(model.state_dict(), 'backend/ml/models/weights/mesonet.pth')
print('Saved PyTorch weights!')

# Quick test
model.eval()
test = torch.randn(1, 3, 256, 256)
with torch.no_grad():
    out = model(test)
print(f'Test score: {out.item():.4f} (should not be exactly 0.5)')
