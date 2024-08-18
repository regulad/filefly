import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { decrypt, encrypt } from "@/utils/secret-encryption";
import { generateClientState } from "@/utils/state-secrets";
import { Client } from "@microsoft/microsoft-graph-client";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { OAuth2Client } from "google-auth-library";
import Dropbox from "next-auth/providers/dropbox";
import Google from "next-auth/providers/google";
import NextAuth, { Account } from "next-auth";
import getPrisma from "@/utils/database";
import { ProviderType } from "@repo/db";
import { google } from "googleapis";
import { uuid } from "uuidv4";

// eslint-disable-next-line turbo/no-undeclared-env-vars -- declared in local turbo.json
export const basePath = process.env.SELF_URL_ORIGIN;

function getMicrosoftGraphClientForAccessToken(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

export async function createOrUpdateGraphSubscription(
  userId: string,
  accessToken: string,
): Promise<void> {
  const client = getMicrosoftGraphClientForAccessToken(accessToken);
  const { clientState, hashedClientState } = await generateClientState();

  // if the user already has a subscription that is valid, we don't need to make a new one
  const existingSubscription = await getPrisma().graphSubscription.findFirst({
    where: {
      userId: userId,
    },
  });

  if (existingSubscription) {
    // check if the subscription is still valid
    const expirationDateTime = existingSubscription.expirationDateTime;
    const oneDayFromNow = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);

    // not valid if it expires in less than a day
    if (expirationDateTime > oneDayFromNow) {
      console.log(
        `Subscription ${existingSubscription.subscriptionId} is still valid for user ${userId}`,
      );
      return;
    }

    // if it isn't valid, update it and update our database

    try {
      const subscription = await client
        .api(`/subscriptions/${existingSubscription.subscriptionId}`)
        .patch({
          expirationDateTime: new Date(Date.now() + 4230 * 60000).toISOString(), // ~3 days
        });

      await getPrisma().graphSubscription.update({
        where: {
          id: existingSubscription.id,
        },
        data: {
          expirationDateTime: new Date(subscription.expirationDateTime),
        },
      });

      console.log(`Updated subscription ${subscription.id} for user ${userId}`);
    } catch (error) {
      console.error("Error updating subscription:", error);
      throw error;
    }
  }

  try {
    const subscription = await client.api("/subscriptions").post({
      changeType: "created,updated,deleted",
      notificationUrl: `${basePath}/api/webhook/onedrive/${userId}`,
      resource: "me/drive/root",
      expirationDateTime: new Date(Date.now() + 4230 * 60000).toISOString(), // ~3 days
      clientState: clientState,
    });

    await getPrisma().graphSubscription.create({
      data: {
        userId: userId,
        subscriptionId: subscription.id,
        resourceId: subscription.resource,
        expirationDateTime: new Date(subscription.expirationDateTime),
        hashedClientState: hashedClientState,
      },
    });

    console.log(`Created subscription ${subscription.id} for user ${userId}`);
  } catch (error) {
    console.error("Error creating subscription:", error);
    throw error;
  }
}

// eslint-disable-next-line turbo/no-undeclared-env-vars -- declared in local turbo.json
const googleClientId = process.env.AUTH_GOOGLE_CLIENT_ID;
// eslint-disable-next-line turbo/no-undeclared-env-vars -- declared in local turbo.json
const googleClientSecret = process.env.AUTH_GOOGLE_CLIENT_SECRET;

if (!googleClientId) {
  throw new Error("AUTH_GOOGLE_CLIENT_ID environment variable is not set");
}

if (!googleClientSecret) {
  throw new Error("AUTH_GOOGLE_CLIENT_SECRET environment variable is not set");
}

export async function getGoogleOAuth2ClientForCredentials(
  googleAccountId: string,
  accessToken: string,
  refreshToken: string,
): Promise<OAuth2Client> {
  const prisma = getPrisma();

  const oauth2Client = new google.auth.OAuth2(
    googleClientId,
    googleClientSecret,
    `${basePath}/api/auth/callback/google`, // Your redirect URI
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  // Set up automatic token refresh
  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      const { encryptedData: encryptedAccessToken, iv: accessTokenIV } =
        encrypt(tokens.access_token);
      await prisma.providerAccount.update({
        where: { id: googleAccountId },
        data: {
          accessTokenEncrypted: encryptedAccessToken,
          accessTokenInitializationVector: accessTokenIV,
          accessTokenExpiresAt: tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : undefined,
        },
      });
    }
    if (tokens.refresh_token) {
      const { encryptedData: encryptedRefreshToken, iv: refreshTokenIV } =
        encrypt(tokens.refresh_token);
      await prisma.providerAccount.update({
        where: { id: googleAccountId },
        data: {
          refreshTokenEncrypted: encryptedRefreshToken,
          refreshTokenInitializationVector: refreshTokenIV,
        },
      });
    }
  });

  return oauth2Client;
}

export async function getGoogleOAuth2ClientForUserId(
  userId: string,
): Promise<OAuth2Client> {
  const prisma = getPrisma();

  // Retrieve the encrypted tokens from the database
  const providerAccount = await prisma.providerAccount.findFirst({
    where: {
      ownerId: userId,
      type: ProviderType.GOOGLE_DRIVE,
    },
  });

  if (!providerAccount) {
    throw new Error("Google Drive provider account not found for user");
  }

  // Decrypt the tokens
  const accessToken = decrypt(
    providerAccount.accessTokenInitializationVector,
    providerAccount.accessTokenEncrypted,
  );
  const refreshToken = decrypt(
    providerAccount.refreshTokenInitializationVector,
    providerAccount.refreshTokenEncrypted,
  );

  return getGoogleOAuth2ClientForCredentials(
    providerAccount.id,
    accessToken,
    refreshToken,
  );
}

export async function createGoogleDriveSubscription(
  oauth2Client: OAuth2Client,
  userId: string,
): Promise<void> {
  const drive = google.drive({ version: "v3", auth: oauth2Client });
  const prisma = getPrisma();

  try {
    const channelId = uuid(); // Generate a unique channel ID

    const startPageTokenResponse = await drive.changes.getStartPageToken({});
    const pageToken = startPageTokenResponse.data.startPageToken ?? undefined;

    const response = await drive.changes.watch({
      pageToken: pageToken,
      requestBody: {
        id: channelId,
        type: "web_hook",
        address: `${basePath}/api/webhook/google-drive/${userId}`,
        expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .getTime()
          .toString(),
      },
    });

    const resourceId = response.data.resourceId;

    if (!resourceId) {
      throw new Error("Resource ID is missing in the response");
    }

    // Store the webhook details in the database
    await prisma.googleDriveWebhook.upsert({
      where: { userId: userId },
      update: {
        channelId: channelId,
        resourceId: resourceId,
        expiration: new Date(Number(response.data.expiration)),
      },
      create: {
        userId: userId,
        channelId: channelId,
        resourceId: resourceId,
        expiration: new Date(Number(response.data.expiration)),
      },
    });

    console.log(`Created Google Drive webhook for user ${userId}`);
  } catch (error) {
    console.error("Error creating Google Drive webhook:", error);
    throw error;
  }
}

function getProviderTypeForNextAuthProviderString(provider: string): ProviderType | null {
  switch (provider) {
    case "dropbox":
      return ProviderType.DROPBOX;
    case "microsoft-entra-id":
      return ProviderType.MICROSOFT_ONEDRIVE;
    case "google":
      return ProviderType.GOOGLE_DRIVE;
    default:
      return null;
  }
}

async function storeProviderCredentials(
  userId: string,
  account: Account,
): Promise<void> {
  const prisma = getPrisma();
  const {
    provider,
    providerAccountId,
    access_token,
    refresh_token,
    expires_at,
  } = account;

  if (!access_token) {
    throw new Error("Access token is missing");
  }

  if (!refresh_token) {
    throw new Error("Refresh token is missing");
  }

  if (!expires_at) {
    throw new Error("Access token expiration time is missing");
  }

  const providerType = getProviderTypeForNextAuthProviderString(provider);

  if (!providerType) {
    throw new Error("Unsupported provider type");
  }

  const { encryptedData: encryptedAccessToken, iv: accessTokenIV } =
    encrypt(access_token);
  const { encryptedData: encryptedRefreshToken, iv: refreshTokenIV } =
    encrypt(refresh_token);

  await prisma.providerAccount.upsert({
    where: {
      ownerId_type_accountId: {
        ownerId: userId,
        type: providerType,
        accountId: providerAccountId,
      },
    },
    update: {
      accessTokenEncrypted: encryptedAccessToken,
      accessTokenInitializationVector: accessTokenIV,
      refreshTokenEncrypted: encryptedRefreshToken,
      refreshTokenInitializationVector: refreshTokenIV,
      accessTokenExpiresAt: new Date(expires_at * 1000),
      scopes: account.scope ? account.scope.split(" ") : [],
    },
    create: {
      owner: { connect: { id: userId } },
      type: providerType,
      accountId: providerAccountId,
      accessTokenEncrypted: encryptedAccessToken,
      accessTokenInitializationVector: accessTokenIV,
      refreshTokenEncrypted: encryptedRefreshToken,
      refreshTokenInitializationVector: refreshTokenIV,
      accessTokenExpiresAt: new Date(expires_at * 1000),
      scopes: account.scope ? account.scope.split(" ") : [],
    },
  });
}

async function registerWebhook(
  userId: string,
  account: Account,
): Promise<void> {
  const { provider, access_token } = account;

  if (!access_token) {
    throw new Error("Access token is missing");
  }

  switch (provider) {
    case "microsoft-entra-id":
      await createOrUpdateGraphSubscription(userId, access_token);
      break;
    case "google": {
      // have to scope in to create a const
      const oauth2Client = await getGoogleOAuth2ClientForUserId(userId);
      await createGoogleDriveSubscription(oauth2Client, access_token);
      break;
    }
    // dropbox uses one webhook for all accounts; manual registration is not required
  }
}

export async function doTokenRefresh(
  userId: string,
  providerType: ProviderType,
): Promise<void> {
  const prisma = getPrisma();

  const providerAccount = await prisma.providerAccount.findFirst({
    where: {
      ownerId: userId,
      type: providerType,
    },
  });

  if (!providerAccount) {
    throw new Error("Provider account not found");
  }

  if (!providerAccount.refreshTokenEncrypted) {
    throw new Error("Refresh token is missing");
  }

  const refreshToken = decrypt(
    providerAccount.refreshTokenInitializationVector,
    providerAccount.refreshTokenEncrypted,
  );

  const accessToken = decrypt(
    providerAccount.accessTokenInitializationVector,
    providerAccount.accessTokenEncrypted,
  );

  // see if access token is still valid by surveying the
  // TODO
}

// @ts-ignore -- complaint about auth's type source
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Dropbox({
      // dropbox overrides authorization instead of passing it to options for a deep-clone so we have to provide it manually
      authorization: `https://www.dropbox.com/oauth2/authorize?token_access_type=offline&scope=${["account_info.read", "files.metadata.read", "files.content.read"].join("%20")}`,
      // eslint-disable-next-line turbo/no-undeclared-env-vars -- declared in local turbo.json
      clientId: process.env.AUTH_DROPBOX_APP_KEY,
      // eslint-disable-next-line turbo/no-undeclared-env-vars -- declared in local turbo.json
      clientSecret: process.env.AUTH_DROPBOX_APP_SECRET,
    }),
    MicrosoftEntraID({
      authorization: {
        params: {
          scope:
            /* default next-auth scopes */ "openid profile email User.Read" +
            " " +
            /* onedrive scopes + refresh tokens */ "offline_access Files.Read Files.Read.All",
        },
        // eslint-disable-next-line turbo/no-undeclared-env-vars -- declared in local turbo.json
        clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
        // eslint-disable-next-line turbo/no-undeclared-env-vars -- declared in local turbo.json
        clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
        // eslint-disable-next-line turbo/no-undeclared-env-vars -- declared in local turbo.json
        tenantId: process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID,
      },
    }),
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: [
            "openid",
            "profile",
            "email",
            "https://www.googleapis.com/auth/drive.readonly",
            "https://www.googleapis.com/auth/drive.metadata.readonly",
          ].join(" "),
        },
      },
    }),
  ],
  basePath: basePath,
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- implicitly set at build time
  debug: process.env.NODE_ENV !== "production",
  adapter: PrismaAdapter(getPrisma()), // requires DATABASE_URL at build time, possible problem?
  callbacks: {
    async signIn({ user, account }) {
      if (account && user.id) {
        await storeProviderCredentials(user.id, account);
        try {
          await registerWebhook(user.id, account);
        } catch (error) {
          console.error("Error registering webhook:", error);
        }
      }
      return true;
    },
  },
});
