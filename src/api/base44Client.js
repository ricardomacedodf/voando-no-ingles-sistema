import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const normalizedServerUrl = appBaseUrl?.replace(/\/$/, '');

// Client do Base44
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: normalizedServerUrl,
  requiresAuth: false,
  appBaseUrl: normalizedServerUrl,
});