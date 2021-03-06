/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import { LicenseExpirationAlert } from './license_expiration_alert';
import { ALERT_LICENSE_EXPIRATION } from '../../common/constants';
import { fetchLegacyAlerts } from '../lib/alerts/fetch_legacy_alerts';
import { fetchClusters } from '../lib/alerts/fetch_clusters';

const RealDate = Date;

jest.mock('../lib/alerts/fetch_legacy_alerts', () => ({
  fetchLegacyAlerts: jest.fn(),
}));
jest.mock('../lib/alerts/fetch_clusters', () => ({
  fetchClusters: jest.fn(),
}));
jest.mock('moment', () => {
  return function () {
    return {
      format: () => 'THE_DATE',
    };
  };
});

describe('LicenseExpirationAlert', () => {
  it('should have defaults', () => {
    const alert = new LicenseExpirationAlert();
    expect(alert.type).toBe(ALERT_LICENSE_EXPIRATION);
    expect(alert.label).toBe('License expiration');
    expect(alert.defaultThrottle).toBe('1d');
    // @ts-ignore
    expect(alert.actionVariables).toStrictEqual([
      { name: 'expiredDate', description: 'The date when the license expires.' },
      { name: 'clusterName', description: 'The cluster to which the license belong.' },
      {
        name: 'internalShortMessage',
        description: 'The short internal message generated by Elastic.',
      },
      {
        name: 'internalFullMessage',
        description: 'The full internal message generated by Elastic.',
      },
      { name: 'state', description: 'The current state of the alert.' },
      { name: 'action', description: 'The recommended action for this alert.' },
      {
        name: 'actionPlain',
        description: 'The recommended action for this alert, without any markdown.',
      },
    ]);
  });

  describe('execute', () => {
    function FakeDate() {}
    FakeDate.prototype.valueOf = () => 1;

    const clusterUuid = 'abc123';
    const clusterName = 'testCluster';
    const legacyAlert = {
      prefix:
        'The license for this cluster expires in {{#relativeTime}}metadata.time{{/relativeTime}} at {{#absoluteTime}}metadata.time{{/absoluteTime}}.',
      message: 'Update your license.',
      metadata: {
        severity: 1000,
        cluster_uuid: clusterUuid,
        time: 1,
      },
    };
    const getUiSettingsService = () => ({
      asScopedToClient: jest.fn(),
    });
    const getLogger = () => ({
      debug: jest.fn(),
    });
    const monitoringCluster = null;
    const config = {
      ui: {
        show_license_expiration: true,
        ccs: { enabled: true },
        container: { elasticsearch: { enabled: false } },
        metricbeat: { index: 'metricbeat-*' },
      },
    };
    const kibanaUrl = 'http://localhost:5601';

    const replaceState = jest.fn();
    const scheduleActions = jest.fn();
    const getState = jest.fn();
    const executorOptions = {
      services: {
        callCluster: jest.fn(),
        alertInstanceFactory: jest.fn().mockImplementation(() => {
          return {
            replaceState,
            scheduleActions,
            getState,
          };
        }),
      },
      state: {},
    };

    beforeEach(() => {
      // @ts-ignore
      Date = FakeDate;
      (fetchLegacyAlerts as jest.Mock).mockImplementation(() => {
        return [legacyAlert];
      });
      (fetchClusters as jest.Mock).mockImplementation(() => {
        return [{ clusterUuid, clusterName }];
      });
    });

    afterEach(() => {
      Date = RealDate;
      replaceState.mockReset();
      scheduleActions.mockReset();
      getState.mockReset();
    });

    it('should fire actions', async () => {
      const alert = new LicenseExpirationAlert();
      alert.initializeAlertType(
        getUiSettingsService as any,
        monitoringCluster as any,
        getLogger as any,
        config as any,
        kibanaUrl,
        false
      );
      const type = alert.getAlertType();
      await type.executor({
        ...executorOptions,
        // @ts-ignore
        params: alert.defaultParams,
      } as any);
      expect(replaceState).toHaveBeenCalledWith({
        alertStates: [
          {
            cluster: { clusterUuid, clusterName },
            ccs: undefined,
            ui: {
              isFiring: true,
              message: {
                text:
                  'The license for this cluster expires in #relative at #absolute. #start_linkPlease update your license.#end_link',
                tokens: [
                  {
                    startToken: '#relative',
                    type: 'time',
                    isRelative: true,
                    isAbsolute: false,
                    timestamp: 1,
                  },
                  {
                    startToken: '#absolute',
                    type: 'time',
                    isAbsolute: true,
                    isRelative: false,
                    timestamp: 1,
                  },
                  {
                    startToken: '#start_link',
                    endToken: '#end_link',
                    type: 'link',
                    url: 'license',
                  },
                ],
              },
              severity: 'warning',
              resolvedMS: 0,
              triggeredMS: 1,
              lastCheckedMS: 0,
            },
          },
        ],
      });
      expect(scheduleActions).toHaveBeenCalledWith('default', {
        action: '[Please update your license.](elasticsearch/nodes)',
        actionPlain: 'Please update your license.',
        internalFullMessage:
          'License expiration alert is firing for testCluster. Your license expires in THE_DATE. [Please update your license.](elasticsearch/nodes)',
        internalShortMessage:
          'License expiration alert is firing for testCluster. Your license expires in THE_DATE. Please update your license.',
        clusterName,
        expiredDate: 'THE_DATE',
        state: 'firing',
      });
    });

    it('should not fire actions if there is no legacy alert', async () => {
      (fetchLegacyAlerts as jest.Mock).mockImplementation(() => {
        return [];
      });
      const alert = new LicenseExpirationAlert();
      alert.initializeAlertType(
        getUiSettingsService as any,
        monitoringCluster as any,
        getLogger as any,
        config as any,
        kibanaUrl,
        false
      );
      const type = alert.getAlertType();
      await type.executor({
        ...executorOptions,
        // @ts-ignore
        params: alert.defaultParams,
      } as any);
      expect(replaceState).not.toHaveBeenCalledWith({});
      expect(scheduleActions).not.toHaveBeenCalled();
    });

    it('should resolve with a resolved message', async () => {
      (fetchLegacyAlerts as jest.Mock).mockImplementation(() => {
        return [
          {
            ...legacyAlert,
            resolved_timestamp: 1,
          },
        ];
      });
      (getState as jest.Mock).mockImplementation(() => {
        return {
          alertStates: [
            {
              cluster: {
                clusterUuid,
                clusterName,
              },
              ccs: undefined,
              ui: {
                isFiring: true,
                message: null,
                severity: 'danger',
                resolvedMS: 0,
                triggeredMS: 1,
                lastCheckedMS: 0,
              },
            },
          ],
        };
      });
      const alert = new LicenseExpirationAlert();
      alert.initializeAlertType(
        getUiSettingsService as any,
        monitoringCluster as any,
        getLogger as any,
        config as any,
        kibanaUrl,
        false
      );
      const type = alert.getAlertType();
      await type.executor({
        ...executorOptions,
        // @ts-ignore
        params: alert.defaultParams,
      } as any);
      expect(replaceState).toHaveBeenCalledWith({
        alertStates: [
          {
            cluster: { clusterUuid, clusterName },
            ccs: undefined,
            ui: {
              isFiring: false,
              message: {
                text: 'The license for this cluster is active.',
              },
              severity: 'danger',
              resolvedMS: 1,
              triggeredMS: 1,
              lastCheckedMS: 0,
            },
          },
        ],
      });
      expect(scheduleActions).toHaveBeenCalledWith('default', {
        internalFullMessage: 'License expiration alert is resolved for testCluster.',
        internalShortMessage: 'License expiration alert is resolved for testCluster.',
        clusterName,
        expiredDate: 'THE_DATE',
        state: 'resolved',
      });
    });

    it('should not fire actions if we are not showing license expiration', async () => {
      const alert = new LicenseExpirationAlert();
      const customConfig = {
        ...config,
        ui: {
          ...config.ui,
          show_license_expiration: false,
        },
      };
      alert.initializeAlertType(
        getUiSettingsService as any,
        monitoringCluster as any,
        getLogger as any,
        customConfig as any,
        kibanaUrl,
        false
      );
      const type = alert.getAlertType();
      await type.executor({
        ...executorOptions,
        // @ts-ignore
        params: alert.defaultParams,
      } as any);
      expect(replaceState).not.toHaveBeenCalledWith({});
      expect(scheduleActions).not.toHaveBeenCalled();
    });
  });
});
