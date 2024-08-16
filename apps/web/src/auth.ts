import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { generateClientState } from "@/utils/state-secrets";
import { Client } from "@microsoft/microsoft-graph-client";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Dropbox from "next-auth/providers/dropbox";
import getPrisma from "@/utils/database";
import NextAuth from "next-auth";

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
  ],
  basePath: basePath,
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- implicitly set at build time
  debug: process.env.NODE_ENV !== "production",
  adapter: PrismaAdapter(getPrisma()), // requires DATABASE_URL at build time, possible problem?
});
