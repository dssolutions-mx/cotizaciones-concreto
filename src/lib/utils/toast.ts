import { toast } from 'sonner';

/** Uses Sonner (see root layout `<SonnerToaster />`). react-hot-toast had no `<Toaster />` mounted, so these were invisible. */
export const showSuccess = (message: string) => {
  toast.success(message, { duration: 4000 });
};

export const showError = (message: string) => {
  toast.error(message, { duration: 4000 });
};

export const showLoading = (message: string) => {
  return toast.loading(message);
}; 