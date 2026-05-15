"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { PushSubscriptionPayload } from "@/lib/types";
import { VAPID_PUBLIC_KEY } from "@/lib/constants";
import { toast } from "@/hooks/use-toast";

const STORAGE_KEY = "ahso_push_subscription_id";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return "default";
    }
    try {
      return Notification.permission;
    } catch {
      return "default";
    }
  });
  const [hasCheckedSupport, setHasCheckedSupport] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const isConfigured = Boolean(VAPID_PUBLIC_KEY);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setIsSupported("serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
    setPermission(Notification.permission);
    setHasCheckedSupport(true);
  }, []);

  useEffect(() => {
    if (!isSupported) {
      return;
    }

    void navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setIsSubscribed(Boolean(subscription)))
      .catch(() => {
        setIsSubscribed(false);
      });
  }, [isSupported]);

  const canPrompt = useMemo(() => isSupported && isConfigured && permission !== "denied", [isConfigured, isSupported, permission]);
  const unavailableReason = useMemo(() => {
    if (!hasCheckedSupport) {
      return null;
    }

    if (!isSupported) {
      return "Trình duyệt hiện tại không hỗ trợ push notification.";
    }

    if (!isConfigured) {
      return "Push notification chưa được cấu hình VAPID trên môi trường này.";
    }

    if (permission === "denied") {
      return "Trình duyệt đang chặn quyền thông báo. Cần bật lại trong cài đặt trình duyệt.";
    }

    return null;
  }, [hasCheckedSupport, isConfigured, isSupported, permission]);

  const subscribe = async () => {
    if (!canPrompt) {
      return;
    }

    setIsBusy(true);

    try {
      const registration = await navigator.serviceWorker.register("/service-worker.js");
      const nextPermission = permission === "granted" ? "granted" : await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission !== "granted") {
        throw new Error("Bạn chưa cấp quyền thông báo trên trình duyệt.");
      }

      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription =
        existingSubscription ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        }));

      const payload = subscription.toJSON() as PushSubscriptionPayload;
      const response = await apiClient.post("/push/subscriptions", payload);
      const subscriptionId = response.data.data?.id as string | undefined;

      if (subscriptionId) {
        window.localStorage.setItem(STORAGE_KEY, subscriptionId);
      }

      setIsSubscribed(true);
      toast("Đã bật thông báo đẩy trên thiết bị này.");
    } catch (error) {
      toast({
        title: "Lỗi",
        description: getApiErrorMessage(error, "Không thể bật push notification."),
        variant: "destructive"
      });
    } finally {
      setIsBusy(false);
    }
  };

  const unsubscribe = async () => {
    if (!isSupported) {
      return;
    }

    setIsBusy(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
      }

      const subscriptionId = window.localStorage.getItem(STORAGE_KEY);
      if (subscriptionId) {
        await apiClient.delete(`/push/subscriptions/${subscriptionId}`);
        window.localStorage.removeItem(STORAGE_KEY);
      }

      setIsSubscribed(false);
      toast("Đã tắt thông báo đẩy trên thiết bị này.");
    } catch (error) {
      toast({
        title: "Lỗi",
        description: getApiErrorMessage(error, "Không thể tắt push notification."),
        variant: "destructive"
      });
    } finally {
      setIsBusy(false);
    }
  };

  return {
    canPrompt,
    isConfigured,
    hasCheckedSupport,
    isBusy,
    isSubscribed,
    isSupported,
    permission,
    subscribe,
    unsubscribe,
    unavailableReason
  };
}
