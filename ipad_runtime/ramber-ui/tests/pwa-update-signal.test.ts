// pwa-update-signal.test.ts — trava o mecanismo real (execução real contra
// um fake ServiceWorkerContainerLike, mesma disciplina de WebSocketLike em
// connection-manager.ts: um Service Worker real não dá pra fabricar em
// teste, mas a interface mínima que este módulo consome sim).
import { describe, it, expect, vi } from "vitest";
import { subscribeToServiceWorkerUpdate, type ServiceWorkerContainerLike } from "../src/pwa-update-signal";

function makeFakeContainer(initialController: object | null): {
  container: ServiceWorkerContainerLike;
  fireControllerChange: () => void;
  listenerCount: () => number;
} {
  let controller = initialController;
  const listeners = new Set<() => void>();
  const container: ServiceWorkerContainerLike = {
    get controller() {
      return controller;
    },
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
  };
  return {
    container,
    fireControllerChange: () => {
      controller = {}; // troca de controller real (novo SW assumiu)
      listeners.forEach((l) => l());
    },
    listenerCount: () => listeners.size,
  };
}

describe("subscribeToServiceWorkerUpdate — distingue primeiro registro de atualização real", () => {
  it("NUNCA dispara no primeiro registro desta aba (controller era null antes da troca) — evita falso positivo no boot", () => {
    const { container, fireControllerChange } = makeFakeContainer(null);
    const onUpdateAvailable = vi.fn();
    subscribeToServiceWorkerUpdate(container, onUpdateAvailable);
    fireControllerChange();
    expect(onUpdateAvailable).not.toHaveBeenCalled();
  });

  it("dispara quando JÁ havia um controller ativo e ele foi trocado — a atualização real que o Operador pediu pra sentir", () => {
    const { container, fireControllerChange } = makeFakeContainer({});
    const onUpdateAvailable = vi.fn();
    subscribeToServiceWorkerUpdate(container, onUpdateAvailable);
    fireControllerChange();
    expect(onUpdateAvailable).toHaveBeenCalledTimes(1);
  });

  it("dispara de novo em cada controllerchange subsequente enquanto a assinatura estiver ativa", () => {
    const { container, fireControllerChange } = makeFakeContainer({});
    const onUpdateAvailable = vi.fn();
    subscribeToServiceWorkerUpdate(container, onUpdateAvailable);
    fireControllerChange();
    fireControllerChange();
    expect(onUpdateAvailable).toHaveBeenCalledTimes(2);
  });

  it("a função de cancelamento remove o listener real — nunca dispara depois de cancelado", () => {
    const { container, fireControllerChange, listenerCount } = makeFakeContainer({});
    const onUpdateAvailable = vi.fn();
    const unsubscribe = subscribeToServiceWorkerUpdate(container, onUpdateAvailable);
    expect(listenerCount()).toBe(1);
    unsubscribe();
    expect(listenerCount()).toBe(0);
    fireControllerChange();
    expect(onUpdateAvailable).not.toHaveBeenCalled();
  });
});
