const {
  resolveAnalyticsBuildConfig,
}: {
  resolveAnalyticsBuildConfig: (
    args: string[],
    env: Record<string, string | undefined>
  ) => {
    mode: string;
    prod: boolean;
    debugEndpointEnabled: boolean;
    measurementId: string;
    apiSecret: string;
  };
} = require('../../scripts/analytics-build-config');

describe('analytics build configuration', () => {
  const credentials = {
    GA_MEASUREMENT_ID: 'G-PRODUCTION',
    GA_API_SECRET: 'production-secret',
  };

  test('ignores credentials in normal local and CI builds', () => {
    expect(resolveAnalyticsBuildConfig([], credentials)).toEqual({
      mode: 'disabled',
      prod: false,
      debugEndpointEnabled: false,
      measurementId: '',
      apiSecret: '',
    });
    expect(resolveAnalyticsBuildConfig(['--prod'], credentials)).toEqual({
      mode: 'disabled',
      prod: true,
      debugEndpointEnabled: false,
      measurementId: '',
      apiSecret: '',
    });
  });

  test('allows deliberate analytics builds to use the debug endpoint', () => {
    expect(resolveAnalyticsBuildConfig(['--prod', '--analytics'], credentials)).toEqual({
      mode: 'analytics',
      prod: true,
      debugEndpointEnabled: true,
      measurementId: 'G-PRODUCTION',
      apiSecret: 'production-secret',
    });
  });

  test('requires complete credentials for analytics builds', () => {
    expect(() =>
      resolveAnalyticsBuildConfig(['--analytics'], { GA_MEASUREMENT_ID: 'G-ONLY' })
    ).toThrow('analytics builds require both GA_MEASUREMENT_ID and GA_API_SECRET');
  });

  test('requires complete credentials and disables debug validation for releases', () => {
    expect(resolveAnalyticsBuildConfig(['--release'], credentials)).toEqual({
      mode: 'release',
      prod: true,
      debugEndpointEnabled: false,
      measurementId: 'G-PRODUCTION',
      apiSecret: 'production-secret',
    });
    expect(() => resolveAnalyticsBuildConfig(['--release'], {})).toThrow(
      'release builds require both GA_MEASUREMENT_ID and GA_API_SECRET'
    );
  });
});
