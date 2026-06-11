function readCredentials(env, mode) {
  const measurementId = env.GA_MEASUREMENT_ID?.trim() ?? '';
  const apiSecret = env.GA_API_SECRET?.trim() ?? '';

  if (!measurementId || !apiSecret) {
    throw new Error(`${mode} builds require both GA_MEASUREMENT_ID and GA_API_SECRET`);
  }

  return { measurementId, apiSecret };
}

function resolveAnalyticsBuildConfig(args, env) {
  const release = args.includes('--release');
  const analytics = args.includes('--analytics');

  if (release && analytics) {
    throw new Error('choose either --release or --analytics, not both');
  }

  if (release) {
    return {
      mode: 'release',
      prod: true,
      debugEndpointEnabled: false,
      ...readCredentials(env, 'release'),
    };
  }

  if (analytics) {
    return {
      mode: 'analytics',
      prod: args.includes('--prod'),
      debugEndpointEnabled: true,
      ...readCredentials(env, 'analytics'),
    };
  }

  return {
    mode: 'disabled',
    prod: args.includes('--prod'),
    debugEndpointEnabled: false,
    measurementId: '',
    apiSecret: '',
  };
}

module.exports = { resolveAnalyticsBuildConfig };
