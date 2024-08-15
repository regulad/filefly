import { PrismaAdapter } from "@auth/prisma-adapter";
import getPrisma from "@/utils/database";
import NextAuth from "next-auth";

// @ts-ignore -- complaint about auth's type source
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    {
      id: "dropbox",
      name: "Dropbox",
      type: "oauth",
      authorization: `https://www.dropbox.com/oauth2/authorize?token_access_type=offline&scope=${["account_info.read", "files.metadata.read", "files.content.read"].join("%20")}`,
      token: "https://api.dropboxapi.com/oauth2/token",
      userinfo: "https://api.dropboxapi.com/2/users/get_current_account",
      profile(profile) {
        return {
          id: profile.account_id,
          name: profile.name.display_name,
          email: profile.email,
          image: profile.profile_photo_url,
        };
      },
      checks: ["state", "pkce"],
      // eslint-disable-next-line turbo/no-undeclared-env-vars -- declared in local turbo.json
      clientId: process.env.AUTH_DROPBOX_APP_KEY,
      // eslint-disable-next-line turbo/no-undeclared-env-vars -- declared in local turbo.json
      clientSecret: process.env.AUTH_DROPBOX_APP_SECRET,
    },
  ],
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- declared in local turbo.json
  basePath: process.env.SELF_URL_ORIGIN,
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- implicitly set at build time
  debug: process.env.NODE_ENV !== "production",
  adapter: PrismaAdapter(getPrisma()), // requires DATABASE_URL at build time, possible problem?
});
