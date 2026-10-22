import { afterAll, afterEach, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import React, { act } from 'react';
import type { ConnectionInfo } from '@opencode/client';
import type { SignInMethod } from './providerAuth';

const browser = new Window({ url: 'http://localhost' });
const descriptors = new Map<string, PropertyDescriptor | undefined>();
for (const [name, value] of Object.entries({
  window: browser, document: browser.document, navigator: browser.navigator, localStorage: browser.localStorage,
  HTMLElement: browser.HTMLElement, Element: browser.Element, Node: browser.Node, Event: browser.Event,
  MutationObserver: browser.MutationObserver, getComputedStyle: browser.getComputedStyle.bind(browser),
  requestAnimationFrame: browser.requestAnimationFrame.bind(browser),
  cancelAnimationFrame: browser.cancelAnimationFrame.bind(browser),
  IS_REACT_ACT_ENVIRONMENT: true,
})) {
  descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { value, configurable: true });
}
const { createRoot } = await import('react-dom/client');
const { I18nProvider } = await import('@/lib/i18n');
const { ProviderAuthMethodCards } = await import('./ProviderAuthMethodCards');

afterAll(async () => {
  await browser.happyDOM.close();
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()?.();
});

/** OpenCode Go signs in through the Console's `opencode` integration. */
const consoleSignIn: SignInMethod = { id: 'console', type: 'oauth', label: 'OpenCode Console account' };

const render = async (input: {
  showApiKey: boolean;
  signInMethods: SignInMethod[];
  connections?: ConnectionInfo[];
  activeId?: string | null;
}) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(
    <I18nProvider>
      <ProviderAuthMethodCards
        integrationId="opencode-go"
        showApiKey={input.showApiKey}
        keyMethod={{ type: 'key' }}
        signInIntegrationId="opencode"
        signInMethods={input.signInMethods}
        connections={input.connections ?? []}
        activeId={input.activeId ?? null}
        connectKey={async () => {}}
        onKeySaved={() => {}}
        onSignedIn={() => {}}
      />
    </I18nProvider>,
  ));
  cleanups.push(() => {
    act(() => root.unmount());
    host.remove();
  });
  const card = (name: string) => {
    const trigger = [...host.querySelectorAll('button')].find((button) => button.textContent?.includes(name));
    if (!trigger) throw new Error(`Missing card: ${name}`);
    return trigger;
  };
  return {
    host,
    card,
    keyField: () => host.querySelector('input[type="password"]'),
    open: async (name: string) => {
      await act(async () => card(name).click());
    },
  };
};

test('each way to connect is its own card, closed until picked', async () => {
  const view = await render({ showApiKey: true, signInMethods: [consoleSignIn] });

  expect(view.card('API key').textContent).toContain('Not connected');
  expect(view.card('OpenCode Console account').textContent).toContain('Sign in through your browser.');
  expect(view.keyField()).toBeNull();

  await view.open('API key');
  expect(view.keyField()).not.toBeNull();
  expect(view.host.textContent).not.toContain('Connect');

  await view.open('OpenCode Console account');
  expect(view.host.textContent).toContain('Connect');
});

test('a provider with one way to connect starts with that card open', async () => {
  const view = await render({ showApiKey: true, signInMethods: [] });
  expect(view.keyField()).not.toBeNull();
});

test('the pills say which stored credential is in use', async () => {
  const view = await render({
    showApiKey: true,
    signInMethods: [consoleSignIn],
    connections: [
      { type: 'credential', id: 'cred_key', label: 'OpenCode Go', method: 'key' },
      { type: 'credential', id: 'cred_console', label: 'Default', method: 'oauth' },
    ],
    activeId: 'cred_console',
  });

  expect(view.card('API key').textContent).toContain('Not in use');
  expect(view.card('OpenCode Console account').textContent).toContain('In use');
});
