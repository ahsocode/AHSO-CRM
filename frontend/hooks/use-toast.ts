import { toast as sonnerToast } from "sonner"

// Wrapper that adapts Sonner to accept Shadcn toast-like API
const toast = (options: { title?: string; description?: string; variant?: "default" | "destructive" } | string) => {
  if (typeof options === "string") {
    return sonnerToast(options)
  }

  const message = options.title ? `${options.title}${options.description ? ': ' + options.description : ''}` : options.description

  if (options.variant === "destructive") {
    return sonnerToast.error(message || "Error")
  }

  return sonnerToast.success(message || "Success")
}

// Attach Sonner's methods to our toast wrapper
Object.assign(toast, sonnerToast)

export { toast }

export const useToast = () => {
  return {
    success: (message: string) => sonnerToast.success(message),
    error: (message: string) => sonnerToast.error(message),
    loading: (message: string) => sonnerToast.loading(message),
    promise: <T,>(
      promise: Promise<T>,
      options: {
        loading: string
        success: string
        error: string
      }
    ) => sonnerToast.promise(promise, options),
  }
}
