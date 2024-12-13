import React, { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { 
  Rocket, 
  Shield, 
  Download, 
  CheckCircle2, 
  PuzzleIcon,
  PackageOpen,
  Palette,
  Zap,
  Layout,
  CheckCircle,
  Loader,
  XCircle
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

const executableToLabelMap = {
    'dotNetFx40_Full_x86_x64.exe': '.NET Framework',
    'dxwebsetup.exe': 'DirectX',
    'oalinst.exe': 'OpenAL',
    'VC_redist.x64.exe': 'Visual C++',
    'xnafx40_redist.msi': 'XNA Framework',
};

const UPDATE_FEATURES = [
  {
    icon: <Download className="w-5 h-5" />,
    title: "Automatic Updates",
    description: "Get the latest features and improvements as soon as they're available"
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: "Security Patches",
    description: "Stay protected with important security updates"
  },
  {
    icon: <Zap className="w-5 h-5" />,
    title: "Bug Fixes",
    description: "Receive fixes for any issues automatically"
  }
];

const Welcome = memo(({ welcomeData, onComplete }) => {
  const [isV7Welcome, setIsV7Welcome] = useState(false);
  const [step, setStep] = useState('welcome');
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showDepsAlert, setShowDepsAlert] = useState(false);
  const [showSkipAlert, setShowSkipAlert] = useState(false);
  const [showDepsErrorAlert, setShowDepsErrorAlert] = useState(false);
  const [downloadDirectory, setDownloadDirectory] = useState('');
  const [dependencyStatus, setDependencyStatus] = useState({
    '.NET Framework': { installed: false, icon: null },
    'DirectX': { installed: false, icon: null },
    'OpenAL': { installed: false, icon: null },
    'Visual C++': { installed: false, icon: null },
    'XNA Framework': { installed: false, icon: null },
  });
  const [warningMessage, setWarningMessage] = useState('');
  const [dependenciesInstalled, setDependenciesInstalled] = useState(false);
  const [progress, setProgress] = useState(0);
  const totalDependencies = 5; // Total number of dependencies
  const [errorMessage, setErrorMessage] = useState('');
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [analyticsConsent, setAnalyticsConsent] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [showAnalyticsStep, setShowAnalyticsStep] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(true);

  useEffect(() => {
    const checkWelcomeType = async () => {
      try {
        const isNew = await window.electron.isNew();
        console.log('Is New Installation:', isNew);
        const shouldShowV7 = await window.electron.checkV7Welcome();
        console.log('Should Show V7 Welcome:', shouldShowV7);
        
        setIsV7Welcome(!isNew && shouldShowV7);
        
        if (!isNew) {
          const isV7 = await window.electron.isV7();
          console.log('Is V7:', isV7);
          if (!isV7) {
            const result = await window.electron.createTimestamp();
            console.log('Timestamp Created/Updated:', result);
          }
        }
      } catch (error) {
        console.error('Error checking welcome type:', error);
      }
    };

    checkWelcomeType();
  }, []);

  useEffect(() => {
    const handleDependencyStatus = (event, { name, status }) => {
      const label = executableToLabelMap[name];
      if (!label) return;

      console.log(`Received status for ${label}: ${status}`);

      if (status === 'starting') {
        console.log(`Starting installation of: ${label}`);
        setDependencyStatus(prevStatus => ({
            ...prevStatus,
            [label]: { installed: false, icon: <Loader className="w-5 h-5 animate-spin" /> },
        }));
      } else if (status === 'finished') {
        console.log(`Finished installing: ${label}`);
        setDependencyStatus(prevStatus => {
            const updatedStatus = {
                ...prevStatus,
                [label]: { installed: true, icon: <CheckCircle className="w-5 h-5 text-green-500" /> },
            };
            const allInstalled = Object.values(updatedStatus).every(dep => dep.installed);
            if (allInstalled) {
                setDependenciesInstalled(true);
            }
            console.log('Updated dependency status:', updatedStatus);
            return updatedStatus;
        });
      } else if (status === 'failed') {
        console.error(`Failed to install: ${label}`);
        setDependencyStatus(prevStatus => ({
            ...prevStatus,
            [label]: { installed: false, icon: <XCircle className="w-5 h-5 text-red-500" /> },
        }));
      }
    };

    window.electron.ipcRenderer.on('dependency-installation-status', handleDependencyStatus);

    return () => {
      window.electron.ipcRenderer.off('dependency-installation-status', handleDependencyStatus);
    };
  }, []);

  const handleNext = () => {
    if (step === 'welcome') {
      setStep('directory');
    } else if (step === 'directory') {
      setStep('extension');
    } else if (step === 'extension') {
      setStep('analytics');
    } else if (step === 'analytics') {
      setStep('updates');
    } else if (step === 'updates') {
      setStep('dependencies');
    } else if (step === 'dependencies') {
      setStep('installationComplete');
    } else if (step === 'installationComplete') {
      handleExit(true);
    }
  };

  const handleInstallDependencies = async () => {
    setIsInstalling(true);
    setProgress(0);
    
    // Set all dependencies to loading state
    setDependencyStatus(prevStatus => {
        const updatedStatus = { ...prevStatus };
        Object.keys(updatedStatus).forEach(dep => {
            updatedStatus[dep] = { installed: false, icon: <Loader className="w-5 h-5 animate-spin" /> };
        });
        return updatedStatus;
    });

    // Listen for dependency installation status
    const handleDependencyStatus = (event, { name, status }) => {
        const label = executableToLabelMap[name];
        if (!label) return;

        if (status === 'finished') {
            // Increment progress and set checkmark when installation finishes
            setProgress(prev => prev + 1);
            setDependencyStatus(prevStatus => {
                const updatedStatus = {
                    ...prevStatus,
                    [label]: { installed: true, icon: <CheckCircle className="w-5 h-5 text-green-500" /> },
                };

                // Check if all dependencies are installed after updating the status
                const allInstalled = Object.values(updatedStatus).every(dep => dep.installed);
                if (allInstalled) {
                    setIsInstalling(false); // Stop installation
                    setStep('installationComplete'); // Move to the installation complete step
                }

                return updatedStatus;
            });
        } else if (status === 'failed') {
            // Handle error
            setErrorMessage(`Failed to install ${label}. Please try again.`);
            setShowErrorDialog(true);
            setIsInstalling(false);
        }
    };

    window.electron.ipcRenderer.on('dependency-installation-status', handleDependencyStatus);
    await window.electron.installDependencies();
    window.electron.ipcRenderer.off('dependency-installation-status', handleDependencyStatus);

    setIsInstalling(false);
  };

  const handleRestart = () => {
    setShowErrorDialog(false);
    handleInstallDependencies();
  };

  const handleSkip = () => {
    setShowErrorDialog(false);
  };

  const handleSelectDirectory = async () => {
    const directory = await window.electron.openDirectoryDialog();
    if (directory) {
      setDownloadDirectory(directory);
      const { freeSpace } = await window.electron.getDriveSpace(directory);
      if (freeSpace < 40 * 1024 * 1024 * 1024) {
        setWarningMessage('Woah! You have less than 40 GB of free space on the selected drive. Consider clearing some space or selecting a different drive.');
      } else {
        setWarningMessage('');
      }

      // Save settings with the directory - simplified version
      try {
        const options = {
          seamlessDownloads: true,
          checkVersionOnLaunch: true,
          viewOldDownloadLinks: false,
          seeInappropriateContent: false,
          sendAnalytics: true,
          autoUpdate: true,
          notifications: true,
          primaryGameSource: 'steamrip',
          enabledSources: {
            steamrip: true,
            steamunlocked: false,
            fitpackgames: false,
          },
          ascendaraSettings: {
            preferredCDN: 'auto',
            preferredRegion: 'auto',
            useP2P: true
          }
        };

        const result = await window.electron.saveSettings(options, directory);
        
        if (!result) {
          console.error('Failed to save settings');
          setWarningMessage('Failed to save download directory. Please try again.');
        }
      } catch (error) {
        console.error('Error saving settings:', error);
        setWarningMessage('An error occurred while saving the download directory.');
      }
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.3 }
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: "easeOut" }
    }
  };

  const v7Features = [
    {
      icon: <Palette className="w-5 h-5" />,
      title: "Fresh New Look",
      description: "Your favorite game testing app, now with a modern design and customizable themes that you've been requesting"
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Lightning Fast",
      description: "V7 is optimized for speed and performance to make your experience smoother and faster than ever"
    },
    {
      icon: <Layout className="w-5 h-5" />,
      title: "Smart Organization",
      description: "New filtering and sorting options to manage your game searching and downloading"
    },
    {
      icon: <PuzzleIcon className="w-5 h-5" />,
      title: "Improved User Experience",
      description: "Things are broken up into more pages and better organized to make sure you can find what you need"
    }
  ];

  const handleAnalyticsChoice = async (enableAnalytics) => {
    try {
      // Get current settings first
      const currentSettings = await window.electron.getSettings();
      
      // Update only the analytics setting while preserving others
      const updatedSettings = {
        ...currentSettings,
        sendAnalytics: enableAnalytics
      };
      
      // Save the updated settings with the current download directory
      await window.electron.saveSettings(
        updatedSettings,
        currentSettings.downloadDirectory || ''
      );
      
      setAnalyticsConsent(enableAnalytics);
      handleNext();
    } catch (error) {
      console.error('Error saving analytics preference:', error);
    }
  };

  const handleExit = async (showTour) => {
    setIsExiting(true);
    // Wait for animation to complete before calling onComplete
    await new Promise(resolve => setTimeout(resolve, 800)); 
    await window.electron.createTimestamp();
    onComplete(showTour);
  };

  const handleUpdateChoice = async (enableAutoUpdate) => {
    try {
      const currentSettings = await window.electron.getSettings();
      
      const updatedSettings = {
        ...currentSettings,
        autoUpdate: enableAutoUpdate
      };
      
      await window.electron.saveSettings(
        updatedSettings,
        currentSettings.downloadDirectory || ''
      );
      
      setAutoUpdate(enableAutoUpdate);
      handleNext();
    } catch (error) {
      console.error('Error saving auto-update preference:', error);
    }
  };

  if (isV7Welcome) {
    if (showAnalyticsStep) {
      return (
        <div className={`h-screen bg-background relative overflow-hidden flex items-center justify-center transition-opacity duration-500 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-background" />
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/10 to-transparent" />
          
          <motion.div
            className="w-full max-w-4xl mx-auto px-6 relative z-10"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div 
              className="text-center mb-8"
              variants={itemVariants}
            >
              <h2 className="text-3xl font-bold tracking-tight mb-4">
                Help Us Improve Ascendara
              </h2>
              <p className="text-lg text-foreground/80 mb-8">
                Choose how you'd like to help make Ascendara better for everyone.
              </p>
            </motion.div>

            <motion.div 
              className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
              variants={itemVariants}
            >
              {/* Share Analytics Option */}
              <button
                onClick={() => setAnalyticsConsent(true)}
                className={`p-6 rounded-xl transition-all duration-200 ${
                  analyticsConsent 
                    ? 'bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-2 border-primary scale-105' 
                    : 'bg-card/30 border border-primary/10 hover:border-primary/30'
                }`}
              >
                <div className="flex items-center space-x-3 mb-4">
                  <div className={`p-2 rounded-lg ${analyticsConsent ? 'bg-primary/20' : 'bg-muted'}`}>
                    <Rocket className={`w-6 h-6 ${analyticsConsent ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <h3 className="text-xl font-semibold">Share & Improve</h3>
                </div>
                <ul className="space-y-3 text-left mb-6">
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className={`w-5 h-5 ${analyticsConsent ? 'text-primary' : 'text-muted-foreground'} shrink-0 mt-0.5`} />
                    <span>Help identify and fix issues faster</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className={`w-5 h-5 ${analyticsConsent ? 'text-primary' : 'text-muted-foreground'} shrink-0 mt-0.5`} />
                    <span>Influence future features</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className={`w-5 h-5 ${analyticsConsent ? 'text-primary' : 'text-muted-foreground'} shrink-0 mt-0.5`} />
                    <span>Be part of improving Ascendara</span>
                  </li>
                </ul>
              </button>

              {/* Privacy Option */}
              <button
                onClick={() => setAnalyticsConsent(false)}
                className={`p-6 rounded-xl transition-all duration-200 ${
                  !analyticsConsent 
                    ? 'bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-2 border-primary scale-105' 
                    : 'bg-card/30 border border-primary/10 hover:border-primary/30'
                }`}
              >
                <div className="flex items-center space-x-3 mb-4">
                  <div className={`p-2 rounded-lg ${!analyticsConsent ? 'bg-primary/20' : 'bg-muted'}`}>
                    <Shield className={`w-6 h-6 ${!analyticsConsent ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <h3 className="text-xl font-semibold">Stay Private</h3>
                </div>
                <div className="space-y-4 text-left mb-6">
                  <p>Opt out of sharing anonymous usage data. You can always enable this later in settings if you change your mind.</p>
                  <div className="bg-card/30 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Ascendara never collects personal information or game data.
                      All analytics are anonymous and used solely to improve Ascendara.
                    </p>
                  </div>
                </div>
              </button>
            </motion.div>
            <motion.div 
              className="flex flex-col items-center justify-center"
              variants={itemVariants}
            >
              <Button
                size="lg"
                onClick={() => {
                  handleAnalyticsChoice(analyticsConsent);
                  handleExit(true);
                }}
                className="mb-4 px-12 py-6 text-lg font-semibold text-primary bg-primary/10 hover:bg-primary/20"
              >
                See What's New
              </Button>
              <button
                onClick={() => {
                  handleAnalyticsChoice(analyticsConsent);
                  handleExit(false);
                }}
                className="text-sm text-foreground/60 hover:text-primary transition-colors"
              >
                I'll explore on my own
              </button>
            </motion.div>
          </motion.div>
        </div>
      );
    }
    
    return (
      <div className={`h-screen bg-background relative overflow-hidden flex items-center justify-center transition-opacity duration-500 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-background" />
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/10 to-transparent" />
        
        <motion.div
          className="w-full max-w-5xl mx-auto px-6 relative z-10"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div 
            className="text-center mb-8"
            variants={itemVariants}
          >
            <h1 className="text-6xl font-bold tracking-tight">
              <span className="text-4xl block mb-2 text-foreground/80">Say Hello to</span>
              <div className="relative inline-flex items-center">
                <span className="bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">
                  Ascendara&nbsp;
                </span>
                <span className="relative">
                  <span className="animate-shimmer bg-[linear-gradient(110deg,var(--shimmer-from),45%,var(--shimmer-via),55%,var(--shimmer-to))] bg-[length:200%_100%] inline-block bg-clip-text text-transparent">
                    v7
                  </span>
                </span>
              </div>
            </h1>
          </motion.div>

          <motion.p 
            className="text-xl mb-10 max-w-2xl mx-auto text-center text-foreground/80"
            variants={itemVariants}
          >
            Your continued support has made Ascendara what it is today. Ascendara has been completely 
            rebuilt from the ground up with a new look and feel you've been asking for. 
          </motion.p>

          <motion.div 
            className="grid grid-cols-2 gap-6 mb-10"
            variants={itemVariants}
          >
            {v7Features.map((feature) => (
              <div 
                key={feature.title}
                className="p-5 rounded-xl bg-card/30 backdrop-blur-sm border border-primary/10 hover:bg-card/40 transition-colors"
              >
                <div className="flex items-center space-x-3 mb-3">
                  <div className="text-primary bg-primary/10 p-2 rounded-lg">{feature.icon}</div>
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                </div>
                <p className="text-foreground/70">{feature.description}</p>
              </div>
            ))}
          </motion.div>

          <motion.p 
            className="text-center text-foreground/70 text-sm mb-8"
            variants={itemVariants}
          >
            Every update is inspired by your feedback. Thank you for being part of the journey.
          </motion.p>

          <motion.div 
            className="flex flex-col items-center space-y-4 text-secondary"
            variants={itemVariants}
          >
            <Button
              size="lg"
              onClick={() => setShowAnalyticsStep(true)}
              className="px-8 py-6 text-lg font-semibold bg-primary hover:bg-primary/90"
            >
              Continue
            </Button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`transition-opacity duration-500 ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
      <AlertDialog open={showDepsAlert} onOpenChange={setShowDepsAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Install Dependencies</AlertDialogTitle>
            <AlertDialogDescription>
              You will receive administrator prompts from official Microsoft installers to install the required components. 
              Your computer may need to restart after installation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleInstallDependencies}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showSkipAlert} onOpenChange={setShowSkipAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Skip Dependencies?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to skip installing dependencies? Some games may not work properly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={async () => {
                setShowSkipAlert(false);
                handleExit(true);
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDepsErrorAlert} onOpenChange={setShowDepsErrorAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Installation Failed</AlertDialogTitle>
            <AlertDialogDescription>
              Failed to install dependencies. Please try again or skip if the issue persists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowDepsErrorAlert(false)}>
              Okay
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Error Installing Dependencies</AlertDialogTitle>
            <AlertDialogDescription>
              {errorMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleSkip}>Skip</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestart}>Restart</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-background" />
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/10 to-transparent" />
        
        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <motion.div
              key="welcome"
              className="min-h-screen flex flex-col items-center justify-center p-8 text-center relative z-10"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.div className="flex items-center justify-center mb-8" variants={itemVariants}>
                <h1 className="text-5xl font-bold">
                  <span className="bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">
                    Welcome to Ascendara{' '}
                  </span>
                  <span className="relative">
                    <span className="animate-shimmer bg-[linear-gradient(110deg,var(--shimmer-from),45%,var(--shimmer-via),55%,var(--shimmer-to))] bg-[length:200%_100%] inline-block bg-clip-text text-transparent">
                      v7
                    </span>
                  </span>
                </h1>
              </motion.div>
              
              <motion.p 
                className="text-xl mb-12 max-w-2xl text-foreground/80"
                variants={itemVariants}
              >
                Ascendara v7 is a complete revamp of the app, bringing a complete overhaul to the user interface and experience. While still in development, Ascendara is getting closer to a stable release.
              </motion.p>

              <motion.div 
                className="space-y-6 mb-12 max-w-xl"
                variants={itemVariants}
              >
                <div>
                  <div className="flex items-center space-x-3 p-4 rounded-lg hover:bg-card/50 transition-colors">
                    <Checkbox 
                      id="privacy" 
                      checked={privacyChecked}
                      onCheckedChange={setPrivacyChecked}
                      className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                    />
                    <div className="text-base">
                      <Label htmlFor="privacy" className="inline cursor-pointer">
                        I have read and agree to Ascendara's{' '}
                      </Label>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          window.electron.openURL('https://ascendara.app/privacy');
                        }}
                        className="text-primary hover:underline inline"
                      >
                        Privacy Policy
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-4 rounded-lg hover:bg-card/50 transition-colors">
                    <Checkbox 
                      id="terms" 
                      checked={termsChecked}
                      onCheckedChange={setTermsChecked}
                      className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                    />
                    <div className="text-base">
                      <Label htmlFor="terms" className="inline cursor-pointer">
                        I have read and agree to Ascendara's{' '}
                      </Label>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          window.electron.openURL('https://ascendara.app/terms');
                        }}
                        className="text-primary hover:underline inline"
                      >
                        Terms of Service
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Button
                  size="lg"
                  onClick={handleNext}
                  disabled={!privacyChecked || !termsChecked}
                  className="px-8 py-6 text-lg font-semibold"
                >
                  Get Started
                </Button>
              </motion.div>
            </motion.div>
          )}

          {step === 'directory' && (
            <motion.div
              key="directory"
              className="min-h-screen flex flex-col items-center justify-center p-8 text-center relative z-10"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.div className="flex items-center justify-center mb-8" variants={itemVariants}>
                <h2 className="text-4xl font-bold">Choose Download Location</h2>
              </motion.div>
              
              <motion.p 
                className="text-xl mb-8 max-w-2xl text-foreground/80"
                variants={itemVariants}
              >
                Select where you want your games to be downloaded and installed.
              </motion.p>

              <motion.div 
                className="space-y-6 mb-12 max-w-2xl bg-card/30 p-6 rounded-lg"
                variants={itemVariants}
              >
                <div className="flex items-center space-x-4">
                  <input
                    type="text"
                    value={downloadDirectory}
                    readOnly
                    placeholder="Select a directory..."
                    className="flex-1 px-4 py-2 rounded-lg bg-background border border-primary/20 focus:border-primary focus:outline-none"
                  />
                  <Button
                    variant="outline"
                    onClick={handleSelectDirectory}
                  >
                    Browse
                  </Button>
                </div>
                {warningMessage && (
                  <p className="text-red-500 text-sm">{warningMessage}</p>
                )}

                <div className="text-left space-y-4 mt-6">
                  <div className="flex items-start space-x-3">
                    <PackageOpen className="w-5 h-5 text-primary mt-1" />
                    <p>This is where all your downloaded games will be stored</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Shield className="w-5 h-5 text-primary mt-1" />
                    <p>Make sure you have enough disk space in the selected location</p>
                  </div>
                </div>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Button
                  size="lg"
                  onClick={handleNext}
                  disabled={!downloadDirectory}
                  className="px-8 py-6 text-lg font-semibold"
                >
                  Continue
                </Button>
              </motion.div>
            </motion.div>
          )}

          {step === 'extension' && (
            <motion.div
              key="extension"
              className="min-h-screen flex flex-col items-center justify-center p-8 text-center relative z-10"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.div className="flex items-center justify-center mb-8" variants={itemVariants}>
                <h2 className="text-4xl font-bold">Download Games Faster</h2>
              </motion.div>
              
              <motion.p 
                className="text-xl mb-8 max-w-2xl text-foreground/80"
                variants={itemVariants}
              >
                Get the Ascendara Download Blocker extension for Chrome or Firefox.
              </motion.p>

              <motion.div 
                className="space-y-6 mb-12 max-w-2xl bg-card/30 p-6 rounded-lg"
                variants={itemVariants}
              >
                <h3 className="text-lg font-semibold mb-4">How it works:</h3>
                <div className="space-y-4 text-left">
                  <div className="flex items-start space-x-3">
                    <span className="text-primary font-semibold">1.</span>
                    <p>Click the extension icon and enable the blocker before starting a download</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="text-primary font-semibold">2.</span>
                    <p>When you click a download link, instead of downloading, you'll get the direct download URL</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="text-primary font-semibold">3.</span>
                    <p>Copy the URL and paste it into Ascendara to start downloading your game</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <span className="text-primary font-semibold">4.</span>
                    <p>Disable the blocker when you want to allow normal downloads again</p>
                  </div>
                </div>

                <div className="mt-8 p-4 bg-primary/5 rounded-md">
                  <p className="text-sm text-foreground/70">
                    The extension blocks unwanted downloads and shows you the direct download URL, 
                    making it much easier to download games through Ascendara.
                  </p>
                </div>
              </motion.div>

              <motion.div 
                className="flex justify-center space-x-4"
                variants={itemVariants}
              >
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => window.electron.openURL('https://ascendara.app/extension')}
                  className="px-8 py-6"
                >
                  Get the Extension
                </Button>
                <Button 
                  onClick={handleNext}
                  size="lg"
                  className="px-8 py-6"
                >
                  Continue
                </Button>
              </motion.div>
            </motion.div>
          )}

          {step === 'analytics' && (
            <motion.div
              key="analytics"
              className="min-h-screen flex flex-col items-center justify-center p-8 text-center relative z-10"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.div className="flex items-center justify-center mb-8" variants={itemVariants}>
                <h2 className="text-4xl font-bold">Help Improve Ascendara</h2>
              </motion.div>
              
              <motion.p 
                className="text-xl mb-8 max-w-2xl text-foreground/80"
                variants={itemVariants}
              >
                Shape the future of Ascendara by sharing anonymous usage data.
              </motion.p>

              <motion.div 
                className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 max-w-4xl w-full"
                variants={itemVariants}
              >
                {/* Share Analytics Option */}
                <div className="p-6 rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 hover:border-primary/30 transition-colors">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 rounded-lg bg-primary/20">
                      <Rocket className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Share & Improve</h3>
                  </div>
                  <ul className="space-y-3 text-left mb-6">
                    <li className="flex items-start space-x-2">
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>Help us identify and fix issues faster</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>Influence future features and improvements</span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>Be part of making Ascendara better for everyone</span>
                    </li>
                  </ul>
                  <motion.div 
                    className="flex justify-center"
                    variants={itemVariants}
                  >
                    <Button
                      size="lg"
                      className="w-full bg-primary hover:bg-primary/90"
                      onClick={() => handleAnalyticsChoice(true)}
                    >
                      Share Anonymous Data
                    </Button>
                  </motion.div>
                </div>

                {/* Privacy Option */}
                <div className="p-6 rounded-xl bg-card/30 border border-border flex flex-col">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 rounded-lg bg-muted">
                      <Shield className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold text-muted-foreground">Stay Private</h3>
                  </div>
                  <p className="text-muted-foreground mb-6 text-left">
                    Opt out of sharing anonymous usage data. You can always enable this later in settings if you change your mind.
                  </p>
                  <motion.div 
                    className="flex justify-center mt-auto"
                    variants={itemVariants}
                  >
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full text-muted-foreground"
                      onClick={() => handleAnalyticsChoice(false)}
                    >
                      Continue Without Sharing
                    </Button>
                  </motion.div>
                </div>
              </motion.div>

              <motion.p 
                className="text-sm text-muted-foreground max-w-2xl"
                variants={itemVariants}
              >
                Ascendara never collects personal information or game data. <br/>
                All analytics are anonymous and used solely to improve Ascendara.
              </motion.p>
            </motion.div>
          )}

          {step === 'updates' && (
            <motion.div
              key="updates"
              className="min-h-screen flex flex-col items-center justify-center p-8 text-center relative z-10"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.div className="flex items-center justify-center mb-8" variants={itemVariants}>
                <h2 className="text-4xl font-bold">Stay Up to Date</h2>
              </motion.div>
              
              <motion.p 
                className="text-xl mb-8 max-w-2xl text-foreground/80"
                variants={itemVariants}
              >
                Choose how you want to receive updates for Ascendara.
              </motion.p>

              <motion.div 
                className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 max-w-4xl w-full"
                variants={itemVariants}
              >
                {/* Auto Update Option */}
                <div className="p-6 rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 hover:border-primary/30 transition-colors">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 rounded-lg bg-primary/20">
                      <Download className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Automatic Updates</h3>
                  </div>
                  <div className="space-y-4 mb-6">
                    {UPDATE_FEATURES.map((feature) => (
                      <div key={feature.title} className="flex items-start space-x-2">
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <div className="text-left">
                          <p className="font-medium">{feature.title}</p>
                          <p className="text-sm text-foreground/70">{feature.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    size="lg"
                    className="w-full bg-primary hover:bg-primary/90"
                    onClick={() => handleUpdateChoice(true)}
                  >
                    Enable Auto Updates
                  </Button>
                </div>

                {/* Manual Update Option */}
                <div className="p-6 rounded-xl bg-card/30 border border-border flex flex-col">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 rounded-lg bg-muted">
                      <Shield className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold text-muted-foreground">Manual Updates</h3>
                  </div>
                  <p className="text-muted-foreground mb-6 text-left">
                    Choose when to update Ascendara yourself. You'll be notified when updates are available, 
                    but they won't install automatically.
                  </p>
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full text-muted-foreground mt-auto"
                    onClick={() => handleUpdateChoice(false)}
                  >
                    Never Automatically Update
                  </Button>
                </div>
              </motion.div>

              <motion.p 
                className="text-sm text-muted-foreground max-w-2xl"
                variants={itemVariants}
              >
                You can change this setting later in your preferences.
              </motion.p>
            </motion.div>
          )}

          {step === 'dependencies' && (
            <motion.div
              key="dependencies"
              className="min-h-screen flex flex-col items-center justify-center p-8 text-center relative z-10"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.div className="flex items-center justify-center mb-8" variants={itemVariants}>
                <h2 className="text-4xl font-bold">Essential Dependencies</h2>
              </motion.div>
              
              <motion.div 
                className="space-y-6 mb-12 max-w-2xl"
                variants={itemVariants}
              >
                <p className="text-xl text-foreground/80">
                  To ensure all games run smoothly, Ascendara will help you install these essential components:
                </p>
              
                <div className="grid grid-cols-2 gap-4 text-left">
                  {[
                    { name: '.NET Framework', desc: 'Required for modern games' },
                    { name: 'DirectX', desc: 'Graphics and multimedia' },
                    { name: 'OpenAL', desc: 'Audio processing' },
                    { name: 'Visual C++', desc: 'Runtime components' },
                    { name: 'XNA Framework', desc: 'Game development framework' }
                  ].map((dep) => (
                    <div key={dep.name} className="flex items-start space-x-3 p-4">
                      {dependencyStatus[dep.name].icon}
                      <div>
                        <button
                          type="button"
                          onClick={() => window.electron.openURL(dep.url)}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {dep.name}
                        </button>
                        <p className="text-sm text-foreground/60">{dep.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {isInstalling ? (
                <motion.div 
                  className="space-y-4 w-full max-w-md"
                  variants={itemVariants}
                >
                  <p className="text-lg text-foreground/80">Installing dependencies... {progress}/{totalDependencies}</p>
                  <p className="text-sm text-foreground/60">
                    Please wait and respond to any administrator prompts that appear.
                    Do not close the application.
                  </p>
                  <Progress value={(progress / totalDependencies) * 100} className="h-2" />
                </motion.div>
              ) : (
                <motion.div 
                    className="flex justify-center space-x-4"
                    variants={itemVariants}
                >
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setShowDepsAlert(true)}
                        className="px-8 py-6"
                    >
                        Install Dependencies
                    </Button>
                    <div className="flex flex-col items-center space-y-4">
                        <Button 
                            onClick={() => handleExit(true)}
                            size="lg"
                            className="px-8 py-6"
                        >
                            <Rocket className="mr-2 h-5 w-5" />
                            I have these, I'll take a tour
                        </Button>
                        
                        <button
                            onClick={() => handleExit(false)}
                            className="text-sm text-foreground/60 hover:text-primary transition-colors"
                        >
                            Skip the tour
                        </button>
                    </div>
                </motion.div>
              )}
            </motion.div>
          )}
          {step === 'installationComplete' && (
            <motion.div
                key="installationComplete"
                className="min-h-screen flex flex-col items-center justify-center p-8 text-center relative z-10"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
            >
                <motion.div className="flex items-center justify-center mb-8" variants={itemVariants}>
                    <h2 className="text-4xl font-bold">Dependencies Installed</h2>
                </motion.div>
                
                <motion.p 
                    className="text-xl mb-8 max-w-2xl text-foreground/80"
                    variants={itemVariants}
                >
                    All required dependencies have been successfully installed. Welcome to Ascendara.
                </motion.p>

                <motion.div className="flex justify-center space-x-4" variants={itemVariants}>
                    <Button 
                        onClick={() => handleExit(true)}
                        size="lg"
                        className="px-8 py-6"
                    >
                        <Rocket className="mr-2 h-5 w-5" />
                        Take the Tour
                    </Button>
                    <button
                        onClick={() => handleExit(false)}
                        className="text-sm text-foreground/60 hover:text-primary transition-colors"
                    >
                        Skip Tour
                    </button>
                </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

export default Welcome; 