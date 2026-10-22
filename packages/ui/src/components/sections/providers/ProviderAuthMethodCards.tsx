import React from 'react';
import type { ConnectionInfo, IntegrationKeyMethod } from '@opencode/client';
import { Icon } from '@/components/icon/Icon';
import type { IconName } from '@/components/icon/icons';
import {
  IntegrationCatalogCard,
  type IntegrationCatalogStatusTone,
} from '@/components/sections/integrations/IntegrationCatalogCard';
import { useI18n } from '@/lib/i18n';
import { ProviderApiKeyForm, type IntegrationKeyRequest } from './ProviderApiKeyForm';
import { ProviderOAuthMethods } from './ProviderOAuthMethods';
import type { CredentialConnection, SignInMethod } from './providerAuth';

type CredentialMethod = CredentialConnection['method'];

/** The pill on one card. */
type MethodStatus = { label: string; tone: IntegrationCatalogStatusTone };

// Sign-in method ids come from OpenCode; the key card's id cannot clash with them.
const KEY_CARD_ID = ':key';

const METHOD_ICON = {
  key: 'key',
  oauth: 'user-3',
  external: 'terminal-box',
} satisfies Record<CredentialMethod, IconName>;

interface ProviderAuthMethodCardsProps {
  /** The provider's own integration, which stores its API key. */
  integrationId: string;
  showApiKey: boolean;
  keyMethod: IntegrationKeyMethod | undefined;
  /** The integration whose sign-in methods serve the provider (`getSignInIntegrationId`). */
  signInIntegrationId: string;
  signInMethods: readonly SignInMethod[];
  /** Connections already stored for the provider; empty while nothing is connected. */
  connections: readonly ConnectionInfo[];
  /** The credential requests go through, when one is stored. */
  activeId: string | null;
  connectKey: (request: IntegrationKeyRequest) => Promise<void>;
  onKeySaved: () => void;
  onSignedIn: () => void | Promise<void>;
}

/**
 * The ways to connect a provider, one collapsible card each: the API key and
 * every sign-in method. The cards are alternatives, and each says on its own
 * pill whether a credential of its kind is the one in use. A credential does
 * not record which sign-in method created it, so every sign-in card of one kind
 * shares that pill.
 *
 * Closing a card unmounts its body, which cancels a sign-in still waiting there.
 */
export const ProviderAuthMethodCards: React.FC<ProviderAuthMethodCardsProps> = ({
  integrationId,
  showApiKey,
  keyMethod,
  signInIntegrationId,
  signInMethods,
  connections,
  activeId,
  connectKey,
  onKeySaved,
  onSignedIn,
}) => {
  const { t } = useI18n();
  const cardIds = [...(showApiKey ? [KEY_CARD_ID] : []), ...signInMethods.map((method) => method.id)];
  // A single way to connect has nothing to choose between, so it starts open.
  const [openCards, setOpenCards] = React.useState<ReadonlySet<string>>(
    () => new Set(cardIds.length === 1 ? cardIds : []),
  );
  const setOpen = (cardId: string, open: boolean) => {
    setOpenCards((previous) => {
      const next = new Set(previous);
      if (open) next.add(cardId);
      else next.delete(cardId);
      return next;
    });
  };

  const statusOf = (method: CredentialMethod): MethodStatus => {
    const stored = connections.filter(
      (connection): connection is CredentialConnection => connection.type === 'credential' && connection.method === method,
    );
    if (stored.some((connection) => connection.id === activeId)) {
      return { label: t('settings.providers.methods.status.inUse'), tone: 'success' };
    }
    if (stored.length > 0) return { label: t('settings.providers.methods.status.notInUse'), tone: 'neutral' };
    return { label: t('settings.providers.methods.status.notConnected'), tone: 'neutral' };
  };

  const renderCard = (
    cardId: string,
    method: CredentialMethod,
    name: string,
    description: string,
    body: React.ReactNode,
  ) => {
    const status = statusOf(method);
    return (
      <IntegrationCatalogCard
        key={cardId}
        logo={<Icon name={METHOD_ICON[method]} className="size-5 text-foreground" />}
        name={name}
        description={description}
        status={status.label}
        statusTone={status.tone}
        open={openCards.has(cardId)}
        onOpenChange={(open) => setOpen(cardId, open)}
      >
        {body}
      </IntegrationCatalogCard>
    );
  };

  return (
    <div className="space-y-3">
      {showApiKey ? renderCard(
        KEY_CARD_ID,
        'key',
        t('settings.providers.page.auth.apiKeyLabel'),
        t('settings.providers.methods.key.description'),
        <ProviderApiKeyForm
          key={integrationId}
          integrationId={integrationId}
          keyMethod={keyMethod}
          connectKey={connectKey}
          onSaved={onKeySaved}
        />,
      ) : null}
      {signInMethods.map((method) => renderCard(
        method.id,
        method.type,
        method.label,
        method.type === 'external'
          ? t('settings.providers.methods.external.description')
          : t('settings.providers.methods.oauth.description'),
        <ProviderOAuthMethods
          key={`${signInIntegrationId}:${method.id}`}
          integrationId={signInIntegrationId}
          methods={[method]}
          onConnected={onSignedIn}
          showMethodLabels={false}
        />,
      ))}
    </div>
  );
};
