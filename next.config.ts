import type {NextConfig} from "next";

const nextConfig: NextConfig = {
  env: {
    apiKey: process.env.API_KEY,
    authDomain: process.env.AUTH_DOMAIN,
    databaseURL: process.env.DATABASE_URL,
    projectId: process.env.PROJECT_ID,
    storageBucket: process.env.STORAGE_BUCKET,
    messagingSenderId: process.env.MESSAGING_SENDER_ID,
    appId: process.env.APP_ID,
    measurementId: process.env.MEASUREMENT_ID,
    REACT_APP_EMAIL: process.env.REACT_APP_EMAIL,
    REACT_APP_PASSWORD: process.env.REACT_APP_PASSWORD,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    CLIENT_EMAIL: process.env.CLIENT_EMAIL,
    NEXT_PUBLIC_ADSENSE_PUBLISHER_ID:
      process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID,
  },
};

export default nextConfig;
