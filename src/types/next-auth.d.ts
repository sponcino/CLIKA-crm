import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      workspaceId: string
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    workspaceId: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    workspaceId: string
  }
}
