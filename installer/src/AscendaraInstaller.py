import customtkinter as ctk
import threading
import requests
import subprocess
import os
import logging
import datetime
from pathlib import Path
from PIL import Image, ImageTk
from io import BytesIO, StringIO
import time

version = "0.1.0"

# Configure logging
log_stream = StringIO()
logging.basicConfig(
    stream=log_stream,
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)

# Set theme and color settings
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("dark-blue")

class LogWindow(ctk.CTkToplevel):
    def __init__(self):
        super().__init__()
        
        # Configure window
        self.title("Ascendara Installer Logs")
        self.geometry("800x400")
        self.minsize(600, 300)
        self.attributes('-alpha', 0.0)  # Start fully transparent
        
        # Set window icon
        icon_path = os.path.join(os.path.dirname(__file__), "ascendara.ico")
        self.iconbitmap(icon_path)
        
        # Match main window theme
        self.configure(fg_color="#0f172a")
        
        # Create main frame
        self.main_frame = ctk.CTkFrame(self, fg_color="#0f172a", corner_radius=0)
        self.main_frame.pack(fill="both", expand=True, padx=20, pady=20)
        
        # Add log text area with scrollbar
        self.log_text = ctk.CTkTextbox(
            self.main_frame,
            font=ctk.CTkFont(family="Consolas", size=12),
            fg_color="#1e1b4b",
            text_color="#e2e8f0",
            corner_radius=8,
            wrap="none"  # Prevent text wrapping for better log readability
        )
        self.log_text.pack(fill="both", expand=True)
        
        # Add clear button at the bottom
        self.clear_button = ctk.CTkButton(
            self.main_frame,
            text="Clear Logs",
            font=ctk.CTkFont(size=14),
            fg_color="#4f46e5",
            hover_color="#4338ca",
            height=32,
            command=self.clear_logs
        )
        self.clear_button.pack(pady=(10, 0))
        
        # Initialize with existing logs
        self.update_logs()
        
        # Fade in
        self.fade_in()
    
    def fade_in(self, current_alpha=0.0):
        if current_alpha < 1.0:
            current_alpha += 0.1
            self.attributes('-alpha', current_alpha)
            self.after(20, lambda: self.fade_in(current_alpha))
    
    def fade_out(self, current_alpha=1.0, on_complete=None):
        if current_alpha > 0:
            current_alpha -= 0.1
            self.attributes('-alpha', current_alpha)
            self.after(20, lambda: self.fade_out(current_alpha, on_complete))
        elif on_complete:
            on_complete()
    
    def close(self):
        self.fade_out(on_complete=self.destroy)
    
    def clear_logs(self):
        self.log_text.configure(state="normal")
        self.log_text.delete(1.0, "end")
        self.log_text.configure(state="disabled")
    
    def update_logs(self):
        # Get logs from the StringIO buffer
        log_buffer = logging.getLogger().handlers[0].stream
        logs = log_buffer.getvalue()
        
        # Update text widget
        self.log_text.configure(state="normal")
        self.log_text.delete(1.0, "end")
        self.log_text.insert("end", logs)
        self.log_text.configure(state="disabled")
        
        # Scroll to bottom
        self.log_text.see("end")
        
        # Schedule next update
        self.after(100, self.update_logs)

class AscendaraInstaller(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        # Initialize logging panel state
        self.log_panel_visible = False
        self.log_update_after_id = None
        
        # Initialize log window reference
        self.log_window = None
        
        # Configure window
        self.title("Ascendara Installer")
        self.geometry("900x600")
        self.resizable(False, False)
        self.overrideredirect(True)  # Hide default title bar
        self.attributes('-topmost', True)  # Make window stay on top
        self.attributes('-alpha', 0.0)  # Start fully transparent
        
        # Center window on screen
        screen_width = self.winfo_screenwidth()
        screen_height = self.winfo_screenheight()
        x = (screen_width - 900) // 2
        y = (screen_height - 600) // 2
        self.geometry(f"900x600+{x}+{y}")
        
        # Additional window attributes to ensure native decorations are hidden
        if os.name == 'nt':  # Windows specific
            self.after(10, lambda: self.attributes('-toolwindow', True))  # Extra measure to hide taskbar icon
        
        # Set window icon
        icon_path = os.path.join(os.path.dirname(__file__), "ascendara.ico")
        self.iconbitmap(icon_path)
        
        # Configure grid
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(0, weight=1)
        
        # Create main frame with background color
        self.main_frame = ctk.CTkFrame(self, fg_color="#ede9fe", corner_radius=0)
        self.main_frame.grid(row=0, column=0, sticky="nsew")
        
        # Add custom title bar
        self.title_bar = ctk.CTkFrame(self.main_frame, fg_color="#9333EA", height=20, corner_radius=0)
        self.title_bar.grid(row=0, column=0, sticky="ew")
        self.title_bar.grid_columnconfigure(0, weight=1)
        
        # Add window title to title bar
        self.window_title = ctk.CTkLabel(
            self.title_bar,
            text="Ascendara Installer (BETA)",
            font=ctk.CTkFont(family="Segoe UI", size=11, weight="bold"),
            text_color="white"
        )
        self.window_title.grid(row=0, column=0, padx=8, pady=2, sticky="w")
        
        # Add window controls
        self.controls_frame = ctk.CTkFrame(self.title_bar, fg_color="transparent")
        self.controls_frame.grid(row=0, column=1, padx=4, pady=2)
        
        # Close button
        self.close_button = ctk.CTkButton(
            self.controls_frame,
            text="✕",
            width=32,
            height=20,
            fg_color="transparent",
            text_color="white",
            hover_color="#dc2626",
            command=self.close
        )
        self.close_button.grid(row=0, column=1, padx=2)
        
        # Create main content frame
        self.content_frame = ctk.CTkFrame(
            self.main_frame,
            fg_color="transparent",
            width=900,
            height=580  # Adjusted for title bar height
        )
        self.content_frame.grid(row=1, column=0, sticky="nsew")
        
        # Create a transparent frame for content
        self.inner_content_frame = ctk.CTkFrame(
            self.content_frame,
            fg_color="transparent",
            width=900,
            height=580
        )
        self.inner_content_frame.place(relx=0.5, rely=0.5, anchor="center")
        
        # Start fade-in animation
        self.fade_in()

        # Add console log button in top-right corner
        self.log_button = ctk.CTkButton(
            self.inner_content_frame,
            text="Show Logs",
            font=ctk.CTkFont(family="Segoe UI", size=12),
            fg_color="#9333EA",
            hover_color="#7C3AED",
            width=80,
            height=28,
            corner_radius=14,
            command=self.toggle_log_panel
        )
        self.log_button.place(relx=0.96, rely=0.05, anchor="ne")
        
        # Load and display logo
        logo_url = "https://raw.githubusercontent.com/tagoWorks/ascendara/refs/heads/main/public/icon.png"
        response = requests.get(logo_url)
        if response.status_code == 200:
            logo_image = Image.open(BytesIO(response.content))
            logo_image = logo_image.resize((130, 130), Image.Resampling.LANCZOS)
            self.logo_photo = ctk.CTkImage(light_image=logo_image, dark_image=logo_image, size=(130, 130))
            self.logo_label = ctk.CTkLabel(
                self.inner_content_frame,
                text="",
                image=self.logo_photo,
                width=130,
                height=130
            )
            self.logo_label.place(relx=0.5, rely=0.23, anchor="center")
        else:
            # Fallback to placeholder if image fails to load
            self.logo_frame = ctk.CTkFrame(
                self.inner_content_frame,
                width=120,
                height=120,
                corner_radius=60,
                fg_color="#9333EA"
            )
            self.logo_frame.place(relx=0.5, rely=0.25, anchor="center")
            
            self.logo_inner = ctk.CTkFrame(
                self.logo_frame,
                width=100,
                height=100,
                corner_radius=50,
                fg_color="#7C3AED"
            )
            self.logo_inner.place(relx=0.5, rely=0.5, anchor="center")
        
        # Title with larger font
        self.title_label = ctk.CTkLabel(
            self.inner_content_frame,
            text="Install Ascendara",
            font=ctk.CTkFont(family="Segoe UI", size=72, weight="bold"),
            text_color="#581c87"
        )
        self.title_label.place(relx=0.5, rely=0.4, anchor="center")
        
        # Fecth ascendara version number from api
        response = requests.get("https://api.ascendara.app/")
        if response.status_code == 200:
            data = response.json()
            appVer = data["appVer"]
            responseText = f"Install version {appVer} of Ascendara onto your computer"
        else:
            responseText = "Install the latest version of Ascendara onto your computer"
        
        # Subtitle with refined styling
        self.subtitle = ctk.CTkLabel(
            self.inner_content_frame,
            text=responseText,
            font=ctk.CTkFont(family="Segoe UI", size=24),
            text_color="#581c87"
        )
        self.subtitle.place(relx=0.5, rely=0.5, anchor="center")

        # Create a frame for the button to add a subtle shadow effect
        self.button_frame = ctk.CTkFrame(
            self.inner_content_frame,
            fg_color="transparent",
            width=320,
            height=96
        )
        self.button_frame.place(relx=0.5, rely=0.65, anchor="center")
        
        # Progress bar (hidden initially)
        self.progress_bar = ctk.CTkProgressBar(
            self.inner_content_frame,
            width=320,
            height=16,
            corner_radius=8,
            fg_color="#E9D5FF",
            progress_color="#9333EA"
        )
        self.progress_bar.place(relx=0.5, rely=0.75, anchor="center")
        self.progress_bar.set(0)
        # Hide progress bar by placing it off-screen initially
        self.progress_bar.place_forget()
        
        # Enhanced install button with hover animation
        self.install_button = ctk.CTkButton(
            self.button_frame,
            text="START",
            font=ctk.CTkFont(family="Segoe UI", size=24, weight="bold"),
            fg_color="#9333EA",
            hover_color="#7C3AED",
            height=72,
            width=320,
            corner_radius=36,
            command=self.start_installation,
            border_width=2,
            border_color="#7C3AED"
        )
        self.install_button.place(relx=0.5, rely=0.5, anchor="center")
        
        # Status label (hidden initially)
        self.status_label = ctk.CTkLabel(
            self.inner_content_frame,
            text="",
            font=ctk.CTkFont(family="Segoe UI", size=18),
            text_color="#581c87"
        )
        self.status_label.place(relx=0.5, rely=0.8, anchor="center")
        
        # Start log update timer
        self.update_log_display()
        
        logging.info("Installer Version " + version)
        
    def fade_in(self, current_alpha=0.0):
        if current_alpha < 1.0:
            current_alpha += 0.1
            self.attributes('-alpha', current_alpha)
            self.after(20, lambda: self.fade_in(current_alpha))
    
    def fade_out(self, current_alpha=1.0, on_complete=None):
        if current_alpha > 0:
            current_alpha -= 0.1
            self.attributes('-alpha', current_alpha)
            self.after(20, lambda: self.fade_out(current_alpha, on_complete))
        elif on_complete:
            on_complete()
    
    def close(self):
        # Close log window if open
        if self.log_window and self.log_window.winfo_exists():
            self.log_window.close()
        
        # Fade out main window
        self.fade_out(on_complete=self.quit)
    
    def toggle_log_panel(self):
        if self.log_window is None or not self.log_window.winfo_exists():
            # Create new log window
            self.log_window = LogWindow()
            self.log_window.focus()
            self.log_button.configure(text="Hide Logs")
        else:
            # Close existing window with fade
            self.log_window.close()
            self.log_window = None
            self.log_button.configure(text="Show Logs")
    
    def update_log_display(self):
        if self.log_window is not None and self.log_window.winfo_exists():
            # Get current log content
            log_content = log_stream.getvalue()
            
            # Update log text if content changed
            current_text = self.log_window.log_text.get("1.0", "end-1c")
            if current_text != log_content:
                self.log_window.log_text.configure(state="normal")
                self.log_window.log_text.delete("1.0", "end")
                self.log_window.log_text.insert("1.0", log_content)
                self.log_window.log_text.configure(state="disabled")
                self.log_window.log_text.see("end")  # Auto-scroll to bottom
        
        # Schedule next update
        self.log_update_after_id = self.after(100, self.update_log_display)

    def download_file(self, url, local_filename):
        try:
            logging.info(f"Starting download from {url}")
            
            # Get file size with HEAD request
            with requests.head(url) as head:
                head.raise_for_status()
                total_size = int(head.headers.get('content-length', 0))
            
            logging.info(f"File size: {total_size / (1024*1024):.1f}MB")
            
            # Download with single request
            with requests.get(url, stream=True) as response:
                response.raise_for_status()
                
                # Create and open output file
                with open(local_filename, 'wb') as f:
                    chunk_size = 1024 * 1024  # 1MB chunks
                    downloaded = 0
                    last_percent = -1
                    
                    for chunk in response.iter_content(chunk_size=chunk_size):
                        if chunk:
                            f.write(chunk)
                            downloaded += len(chunk)
                            
                            # Update progress
                            if total_size > 0:
                                progress = downloaded / total_size
                                self.progress_bar.set(progress)
                                
                                # Calculate download progress
                                downloaded_mb = downloaded / (1024 * 1024)
                                total_mb = total_size / (1024 * 1024)
                                percent = int(progress * 100)
                                
                                # Only log when percentage changes
                                if percent != last_percent and percent % 10 == 0:
                                    logging.info(f"Download progress: {percent}% ({downloaded_mb:.1f}MB / {total_mb:.1f}MB)")
                                    last_percent = percent
                                
                                status_text = f"Downloading... {downloaded_mb:.1f}MB / {total_mb:.1f}MB ({percent}%)"
                                self.status_label.configure(text=status_text)
                                
                                # Update UI
                                self.update_idletasks()
                    
                    # Verify download size
                    if downloaded != total_size:
                        raise Exception(f"Download incomplete. Expected {total_size} bytes but got {downloaded} bytes")
                    
                    # Ensure file is written to disk
                    f.flush()
                    os.fsync(f.fileno())
            
            logging.info(f"Download complete and verified. Total size: {total_size / (1024*1024):.1f}MB")
            return local_filename
            
        except Exception as e:
            logging.error(f"Download error: {str(e)}")
            # Clean up the incomplete file
            if os.path.exists(local_filename):
                try:
                    os.remove(local_filename)
                    logging.info("Cleaned up incomplete download file")
                except:
                    pass
            raise e

    def start_installation(self):
        self.install_button.configure(state="disabled")
        self.status_label.configure(text="Starting download...")
        # Show progress bar
        self.progress_bar.place(relx=0.5, rely=0.75, anchor="center")
        self.progress_bar.set(0)
        
        def installation_process():
            try:
                # Download URL (replace with actual URL)
                url = "https://lfs.ascendara.app/AscendaraInstaller.exe"
                download_path = Path.home() / "Downloads" / "ascendarainstaller.exe"
                
                # Download the file and wait for completion
                local_file = self.download_file(url, str(download_path))
                
                # Double check file exists and has content
                if not os.path.exists(local_file) or os.path.getsize(local_file) == 0:
                    raise Exception("Downloaded file verification failed")
                
                # Update status
                self.status_label.configure(text="Download complete. Starting installation...")
                self.update_idletasks()
                
                # Small delay to ensure file is fully written
                self.after(1000)
                
                # Run the downloaded file and wait for it to complete
                logging.info("Launching Ascendara installer")
                process = subprocess.Popen([str(download_path)], shell=True)
                
                # Update status while waiting
                self.status_label.configure(text="Installing Ascendara...")
                
                # Monitor the process
                while True:
                    if process.poll() is not None:
                        # Process has finished
                        self.status_label.configure(text="Installation complete!")
                        logging.info("Installation complete")
                        # Fade out after showing completion message
                        self.after(1000, self.close)
                        break
                    # Check status every 100ms
                    self.after(100)
                
            except Exception as e:
                error_msg = str(e)
                logging.error(f"Installation error: {error_msg}")
                self.status_label.configure(text=f"Error: {error_msg}")
                self.install_button.configure(state="normal")
                # Hide progress bar on error
                self.progress_bar.place_forget()
        
        thread = threading.Thread(target=installation_process)
        thread.daemon = True
        thread.start()
        
if __name__ == "__main__":
    app = AscendaraInstaller()
    app.mainloop()