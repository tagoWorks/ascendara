import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { CircleCheck, AlertCircle, CircleAlert, ArrowLeft, Loader, XCircle } from "lucide-react";
import { useNavigate } from 'react-router-dom';
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

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, staggerChildren: 0.1 }
  },
  exit: { opacity: 0, y: -20, transition: { duration: 0.4 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const Dependencies = () => {
  const { t } = useTranslation();
  const [dependencyStatus, setDependencyStatus] = useState(null);
  const navigate = useNavigate();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [completedDeps, setCompletedDeps] = useState(new Set());
  const totalDependencies = 5;

  const executableToLabelMap = {
    'dotNetFx40_Full_x86_x64.exe': t => '.NET Framework 4.0',
    'dxwebsetup.exe': t => 'DirectX',
    'oalinst.exe': t => 'OpenAL',
    'VC_redist.x64.exe': t => 'Visual C++ Redistributable',
    'xnafx40_redist.msi': t => 'XNA Framework',
  };

  // Check dependency status
  const checkDependencies = useCallback(async () => {
    try {
      const status = await window.electron.checkGameDependencies();
      console.log('Initial dependency status:', status);
      
      const mappedStatus = {};
      status.forEach(dep => {
        const label = executableToLabelMap[dep.file](t);
        if (label) {
          console.log(`Mapping ${dep.file} (installed: ${dep.installed}) to ${label}`);
          mappedStatus[label] = getStatusInfo(dep.installed);
        }
      });
      
      console.log('Final mapped status:', mappedStatus);
      setDependencyStatus(mappedStatus);
    } catch (error) {
      console.error('Failed to check dependencies:', error);
    }
  }, [t]);

  useEffect(() => {
    checkDependencies();
  }, [checkDependencies]);

  useEffect(() => {
    const handleDependencyStatus = (event, { name, status }) => {
      const label = executableToLabelMap[name](t);
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
        setCompletedDeps(prev => {
          if (!prev.has(label)) {
            setProgress(p => p + 1);
            return new Set([...prev, label]);
          }
          return prev;
        });
        setDependencyStatus(prevStatus => {
          const updatedStatus = {
            ...prevStatus,
            [label]: { installed: true, icon: <CircleCheck className="w-5 h-5 text-green-500" /> },
          };
          const allInstalled = Object.values(updatedStatus).every(dep => dep.installed);
          if (allInstalled) {
            setIsInstalling(false);
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
  }, [t]);

  const handleInstallDependencies = async () => {
    setIsInstalling(true);
    setProgress(0);
    setCompletedDeps(new Set());
    setShowConfirmDialog(false);
    
    // Set all dependencies to loading state
    setDependencyStatus(prevStatus => {
      const updatedStatus = { ...prevStatus };
      Object.keys(executableToLabelMap).forEach(dep => {
        const label = executableToLabelMap[dep](t);
        updatedStatus[label] = { installed: false, icon: <Loader className="w-5 h-5 animate-spin" /> };
      });
      return updatedStatus;
    });

    try {
      await window.electron.installDependencies();
      toast.success(t('settings.reinstallSuccess'));
      await checkDependencies();
    } catch (error) {
      console.error('Failed to install dependencies:', error);
      toast.error(t('settings.reinstallError'));
      setIsInstalling(false);
    }
  };

  const getStatusInfo = (installed) => {
    if (installed === undefined || installed === null) {
      return {
        icon: <CircleAlert className="w-5 h-5 text-muted-foreground" />,
        status: 'checking'
      };
    }
    return installed ? {
      icon: <CircleCheck className="w-5 h-5 text-green-500" />,
      status: 'installed'
    } : {
      icon: <AlertCircle className="w-5 h-5 text-red-500" />,
      status: 'missing'
    };
  };

  const dependencies = [
    { 
      name: '.NET Framework 4.0', 
      desc: t('welcome.requiredForModernGames'),
      url: 'https://dotnet.microsoft.com/download/dotnet-framework/net40'
    },
    { 
      name: 'DirectX', 
      desc: t('welcome.graphicsAndMultimedia'),
      url: 'https://www.microsoft.com/en-us/download/details.aspx?id=35'
    },
    { 
      name: 'OpenAL', 
      desc: t('welcome.audioProcessing'),
      url: 'https://www.openal.org/downloads/'
    },
    { 
      name: 'Visual C++ Redistributable', 
      desc: t('welcome.runtimeComponents'),
      url: 'https://aka.ms/vs/17/release/vc_redist.x64.exe'
    },
    { 
      name: 'XNA Framework', 
      desc: t('welcome.gameDevelopmentFramework'),
      url: 'https://www.microsoft.com/en-us/download/details.aspx?id=20914'
    }
  ];

  return (
    <>
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold text-foreground">{t('welcome.installDependencies')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('welcome.youWillReceiveAdminPrompts')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-primary" >{t('welcome.cancel')}</AlertDialogCancel>
            <AlertDialogAction className="bg-primary text-secondary" onClick={handleInstallDependencies}>{t('welcome.continue')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <motion.div
        className="fixed inset-0 flex items-center justify-center bg-background/95 backdrop-blur-sm z-50"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <motion.div className="flex flex-col items-center max-w-4xl w-full px-8" variants={itemVariants}>
          <div className="w-full mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/settings')}
              className="hover:bg-accent hover:text-accent-foreground rounded-full"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
          </div>
          <motion.div className="flex items-center justify-center mb-8" variants={itemVariants}>
            <h2 className="text-4xl font-bold text-primary">{t('settings.installGameDependencies')}</h2>
          </motion.div>
          <motion.div 
            className="space-y-6 w-full"
            variants={itemVariants}
          >
            <p className="text-xl text-foreground/80 text-center">
              {t('settings.reinstallDependenciesDesc')}
            </p>
            {isInstalling && (
              <div className="w-full bg-secondary rounded-full h-2 mb-4">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(progress / totalDependencies) * 100}%` }}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 text-left text-muted-foreground">
              {dependencies.map((dep) => (
                <div key={dep.name} className="flex items-start space-x-3 p-4 bg-card rounded-lg border">
                  {dependencyStatus?.[dep.name]?.icon}
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
            <div className="flex justify-center mt-8">
              <Button
                onClick={() => setShowConfirmDialog(true)}
                className="text-secondary"
                disabled={isInstalling}
              >
                {isInstalling ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    {t('welcome.installingDependencies')}
                  </>
                ) : (
                  t('settings.reinstallDependencies')
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </>
  );
};

export default Dependencies;
