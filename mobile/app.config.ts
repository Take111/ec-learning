import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  // app.json 側の必須項目。無ければ設定ミスなので早期に落とす(型の narrowing も兼ねる)
  if (!config.name || !config.slug) {
    throw new Error('app.json の expo.name / expo.slug が必要です');
  }

  const appleTeamId = process.env.EC_APPLE_TEAM_ID?.trim();

  return {
    ...config,
    name: config.name,
    slug: config.slug,
    ios: {
      ...config.ios,
      // 未設定時はキー自体を付けない(undefined を渡すより「設定していない」ことが明示的)
      ...(appleTeamId ? { appleTeamId } : {}),
    },
  };
};
