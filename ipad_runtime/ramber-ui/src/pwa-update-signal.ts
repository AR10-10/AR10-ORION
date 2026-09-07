// pwa-update-signal.ts — detecta quando uma versão NOVA do Service Worker
// (sw/build-sw.mjs) assumiu o controle da página ENQUANTO ela já estava
// aberta. skipWaiting()+clients.claim() em build-sw.mjs fazem o SW novo
// assumir na hora, sem esperar a aba fechar — mas o JS já carregado na
// página continua sendo o ANTIGO até um reload real (comportamento padrão
// de PWA, documentado no próprio build-sw.mjs: "um deploy novo aplica no
// lançamento seguinte"). Esse sinal real (evento `controllerchange`) já
// existia no navegador; nunca virava aviso nenhum na tela — pedido do
// Operador ("eu quero sentir a evolução rodando") pede o oposto.
//
// Por que não é `navigator.serviceWorker` direto aqui dentro: a mesma
// disciplina de WebSocketLike em connection-manager.ts — um SW real não dá
// pra fabricar uma segunda ativação em teste; a interface mínima abaixo é
// o que este módulo realmente usa, testável com um fake determinístico.
export interface ServiceWorkerContainerLike {
  controller: object | null;
  addEventListener(type: "controllerchange", listener: () => void): void;
  removeEventListener(type: "controllerchange", listener: () => void): void;
}

/** Distinção real que evita um falso positivo: no PRIMEIRO registro desta
 *  aba (nenhum SW controlava a página ainda), o SW novo assume e dispara
 *  o MESMO evento `controllerchange` — isso é o boot normal, nunca uma
 *  atualização. Só conta como atualização real quando JÁ existia um
 *  controller no instante da assinatura e ele foi TROCADO depois. */
export function subscribeToServiceWorkerUpdate(
  container: ServiceWorkerContainerLike,
  onUpdateAvailable: () => void,
): () => void {
  const hadControllerAtSubscribeTime = container.controller !== null;
  const handler = () => {
    if (hadControllerAtSubscribeTime) onUpdateAvailable();
  };
  container.addEventListener("controllerchange", handler);
  return () => container.removeEventListener("controllerchange", handler);
}
