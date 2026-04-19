"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { getAccessToken } from "@/lib/auth";
import { BACKEND_URL } from "@/lib/constants";
import { RealtimeEvent } from "@/lib/types";
import { toast } from "@/hooks/use-toast";

function getInvalidateKeys(event: RealtimeEvent["event"]) {
  switch (event) {
    case "customer.created":
    case "customer.updated":
    case "customer.deleted":
    case "customer.assigned":
      return [["customers"], ["dashboard"], ["reports"], ["notifications"], ["notifications", "unread-count"]];
    case "project.created":
    case "project.status_changed":
      return [["projects"], ["dashboard"], ["reports"], ["notifications"], ["notifications", "unread-count"]];
    case "quote.sent":
    case "quote.accepted":
    case "quote.rejected":
      return [["quotes"], ["dashboard"], ["reports"], ["notifications"], ["notifications", "unread-count"]];
    case "contract.signed":
    case "contract.completed":
    case "payment.received":
    case "payment.overdue":
    case "milestone.due_soon":
      return [["contracts"], ["projects"], ["dashboard"], ["reports"], ["notifications"], ["notifications", "unread-count"]];
    case "activity.assigned":
    case "mention.created":
      return [["activities"], ["calendar"], ["dashboard"], ["notifications"], ["notifications", "unread-count"]];
    default:
      return [["dashboard"], ["notifications"], ["notifications", "unread-count"]];
  }
}

function getToastMessage(event: RealtimeEvent) {
  switch (event.event) {
    case "customer.assigned":
      return event.payload.customerName ? `Khách hàng ${String(event.payload.customerName)} vừa được cập nhật.` : "Có thay đổi mới ở khách hàng.";
    case "quote.accepted":
      return event.payload.quoteNo ? `Báo giá ${String(event.payload.quoteNo)} vừa được chấp nhận.` : "Có báo giá vừa được chấp nhận.";
    case "quote.rejected":
      return event.payload.quoteNo ? `Báo giá ${String(event.payload.quoteNo)} vừa bị từ chối.` : "Có báo giá vừa bị từ chối.";
    case "contract.signed":
      return event.payload.contractNo ? `Hợp đồng ${String(event.payload.contractNo)} vừa chuyển sang hiệu lực.` : "Có hợp đồng vừa được kích hoạt.";
    case "contract.completed":
      return event.payload.contractNo ? `Hợp đồng ${String(event.payload.contractNo)} vừa hoàn tất.` : "Có hợp đồng vừa hoàn tất.";
    case "payment.received":
      return "Hệ thống vừa ghi nhận một khoản thanh toán mới.";
    case "mention.created":
      return "Bạn vừa được nhắc tới trong một ghi chú.";
    case "activity.assigned":
      return "Bạn vừa được giao một hoạt động mới.";
    default:
      return "";
  }
}

export function useWebsocket(enabled = true) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);

  const socketUrl = useMemo(() => `${BACKEND_URL}/events`, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const accessToken = getAccessToken();

    if (!accessToken) {
      return;
    }

    const socket: Socket = io(socketUrl, {
      transports: ["websocket"],
      auth: {
        token: accessToken
      },
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity
    });

    socket.on("connect", () => {
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("domain-event", (event: RealtimeEvent) => {
      setLastEvent(event);
      setLastEventAt(Date.now());

      const invalidateKeys = getInvalidateKeys(event.event);
      invalidateKeys.forEach((key) => {
        void queryClient.invalidateQueries({ queryKey: key });
      });

      const toastMessage = getToastMessage(event);
      if (toastMessage) {
        toast(toastMessage);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [enabled, queryClient, socketUrl]);

  return {
    isConnected,
    lastEvent,
    lastEventAt
  };
}
