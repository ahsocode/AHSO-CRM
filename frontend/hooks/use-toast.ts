import { toast as sonnerToast } from "sonner"

export const toast = sonnerToast

export const useToast = () => {
  return {
    success: (message: string) => toast.success(message),
    error: (message: string) => toast.error(message),
    loading: (message: string) => toast.loading(message),
    promise: <T,>(
      promise: Promise<T>,
      options: {
        loading: string
        success: string
        error: string
      }
    ) => toast.promise(promise, options),
  }
}
