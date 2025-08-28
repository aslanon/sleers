// Test script for auto-updater
const { ipcRenderer } = require('electron');

// Update için UI bildirim kodları
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    // Update available notification
    ipcRenderer.on('UPDATE_AVAILABLE', (event, info) => {
      console.log('Update available:', info);
      // UI'da notification göster
      showUpdateNotification(`New version ${info.version} is available!`);
    });

    // Download progress
    ipcRenderer.on('UPDATE_PROGRESS', (event, progress) => {
      console.log(`Download progress: ${progress.percent.toFixed(2)}%`);
      // Progress bar güncelle
      updateProgressBar(progress.percent);
    });

    // Update downloaded
    ipcRenderer.on('UPDATE_DOWNLOADED', (event, info) => {
      console.log('Update downloaded:', info);
      // Restart butonu göster
      showRestartDialog(info.version);
    });

    // Manual check button
    const checkUpdateBtn = document.getElementById('check-update');
    if (checkUpdateBtn) {
      checkUpdateBtn.addEventListener('click', () => {
        ipcRenderer.invoke('CHECK_FOR_UPDATES');
      });
    }

    // Restart button
    const restartBtn = document.getElementById('restart-update');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        ipcRenderer.invoke('RESTART_AND_UPDATE');
      });
    }
  });
}

function showUpdateNotification(message) {
  // Simple notification
  const notification = document.createElement('div');
  notification.innerHTML = `
    <div style="position: fixed; top: 20px; right: 20px; background: #007bff; color: white; padding: 15px; border-radius: 5px; z-index: 9999;">
      ${message}
      <button onclick="this.parentElement.remove()" style="margin-left: 10px; background: rgba(255,255,255,0.3); border: none; color: white; padding: 5px 10px; border-radius: 3px;">×</button>
    </div>
  `;
  document.body.appendChild(notification);
}

function updateProgressBar(percent) {
  let progressBar = document.getElementById('update-progress');
  if (!progressBar) {
    progressBar = document.createElement('div');
    progressBar.id = 'update-progress';
    progressBar.innerHTML = `
      <div style="position: fixed; top: 70px; right: 20px; background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; z-index: 9999; min-width: 250px;">
        <div>Downloading update...</div>
        <div style="background: #f0f0f0; height: 10px; border-radius: 5px; margin-top: 10px;">
          <div id="progress-fill" style="background: #007bff; height: 100%; border-radius: 5px; width: 0%; transition: width 0.3s;"></div>
        </div>
        <div id="progress-text" style="margin-top: 5px; font-size: 12px;">0%</div>
      </div>
    `;
    document.body.appendChild(progressBar);
  }
  
  const fill = document.getElementById('progress-fill');
  const text = document.getElementById('progress-text');
  if (fill && text) {
    fill.style.width = percent + '%';
    text.textContent = percent.toFixed(1) + '%';
  }
}

function showRestartDialog(version) {
  const dialog = document.createElement('div');
  dialog.innerHTML = `
    <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; border: 1px solid #ddd; padding: 20px; border-radius: 10px; z-index: 10000; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
      <h3>Update Ready!</h3>
      <p>Version ${version} has been downloaded and is ready to install.</p>
      <div style="margin-top: 15px;">
        <button id="restart-now-btn" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; margin-right: 10px;">Restart Now</button>
        <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 5px;">Later</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  
  dialog.querySelector('#restart-now-btn').addEventListener('click', () => {
    ipcRenderer.invoke('RESTART_AND_UPDATE');
  });
}