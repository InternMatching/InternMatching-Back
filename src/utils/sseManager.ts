import type { Response } from "express";

// userId → all open SSE connections (one per browser tab)
const clients = new Map<string, Set<Response>>();

export function addSSEClient(userId: string, res: Response): void {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId)!.add(res);
}

export function removeSSEClient(userId: string, res: Response): void {
  const connections = clients.get(userId);
  if (!connections) return;
  connections.delete(res);
  if (connections.size === 0) clients.delete(userId);
}

export function pushSSE(userId: string, event: string, data: unknown): void {
  const connections = clients.get(userId);
  if (!connections) return;
  const payload = JSON.stringify(data);
  for (const res of connections) {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${payload}\n\n`);
    } catch {
      connections.delete(res);
    }
  }
  if (connections.size === 0) clients.delete(userId);
}

export function connectedUserIds(): string[] {
  return Array.from(clients.keys());
}
