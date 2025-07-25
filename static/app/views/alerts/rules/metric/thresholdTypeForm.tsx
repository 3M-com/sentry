import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {Select} from 'sentry/components/core/select';
import RadioGroup, {type RadioOption} from 'sentry/components/forms/controls/radioGroup';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {COMPARISON_DELTA_OPTIONS} from 'sentry/views/alerts/rules/metric/constants';
import {isEapAlertType} from 'sentry/views/alerts/rules/utils';
import type {MetricAlertType} from 'sentry/views/alerts/wizard/options';

import {isCrashFreeAlert} from './utils/isCrashFreeAlert';
import {AlertRuleComparisonType, Dataset} from './types';

type Props = {
  alertType: MetricAlertType;
  comparisonType: AlertRuleComparisonType;
  dataset: Dataset;
  disabled: boolean;
  onComparisonDeltaChange: (value: number) => void;
  onComparisonTypeChange: (value: AlertRuleComparisonType) => void;
  organization: Organization;
  comparisonDelta?: number;
};

function ThresholdTypeForm({
  alertType,
  organization,
  dataset,
  disabled,
  comparisonType,
  onComparisonDeltaChange,
  onComparisonTypeChange,
  comparisonDelta,
}: Props) {
  if (isCrashFreeAlert(dataset)) {
    return null;
  }
  const validAnomalyDetectionAlertTypes = new Set([
    'num_errors',
    'users_experiencing_errors',
    'throughput',
    'trans_duration',
    'failure_rate',
    'lcp',
    'fid',
    'cls',
    'custom_transactions',
  ]);

  const hasAnomalyDetection = organization.features.includes('anomaly-detection-alerts');

  const hasAnomalyDetectionForEAP = organization.features.includes(
    'anomaly-detection-eap'
  );

  let comparisonDeltaOptions = COMPARISON_DELTA_OPTIONS;
  if (dataset === Dataset.EVENTS_ANALYTICS_PLATFORM) {
    // Don't allow comparisons over a week for span alerts
    comparisonDeltaOptions = comparisonDeltaOptions.filter(delta => delta.value <= 10080);
  }

  const thresholdTypeChoices: RadioOption[] = [
    [AlertRuleComparisonType.COUNT, 'Static: above or below {x}'],
    [
      AlertRuleComparisonType.CHANGE,
      comparisonType === AlertRuleComparisonType.CHANGE ? (
        // Prevent default to avoid dropdown menu closing on click
        <ComparisonContainer onClick={e => e.preventDefault()}>
          {t('Percent Change: {x%} higher or lower compared to')}
          <Select
            name="comparisonDelta"
            styles={{
              container: (provided: Record<string, string | number | boolean>) => ({
                ...provided,
                marginLeft: space(1),
              }),
              control: (provided: Record<string, string | number | boolean>) => ({
                ...provided,
                minHeight: 30,
                minWidth: 500,
                maxWidth: 1000,
              }),
              valueContainer: (provided: Record<string, string | number | boolean>) => ({
                ...provided,
                padding: 0,
              }),
              singleValue: (provided: Record<string, string | number | boolean>) => ({
                ...provided,
              }),
            }}
            value={comparisonDelta}
            onChange={({value}: any) => onComparisonDeltaChange(value)}
            options={comparisonDeltaOptions}
            required={comparisonType === AlertRuleComparisonType.CHANGE}
          />
        </ComparisonContainer>
      ) : (
        t('Percent Change: {x%} higher or lower compared to previous period')
      ),
    ],
  ];

  if (
    hasAnomalyDetection &&
    (validAnomalyDetectionAlertTypes.has(alertType) ||
      (hasAnomalyDetectionForEAP && isEapAlertType(alertType)))
  ) {
    thresholdTypeChoices.push([
      AlertRuleComparisonType.DYNAMIC,
      <ComparisonContainer key="Dynamic">
        {t('Anomaly: whenever values are outside of expected bounds')}
      </ComparisonContainer>,
    ] as RadioOption);
  }

  return (
    <Feature features="organizations:change-alerts" organization={organization}>
      <FormRow>
        <StyledRadioGroup
          disabled={disabled}
          choices={thresholdTypeChoices}
          value={comparisonType}
          label={t('Threshold Type')}
          onChange={value => onComparisonTypeChange(value as AlertRuleComparisonType)}
        />
      </FormRow>
    </Feature>
  );
}

const FormRow = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: ${space(2)};
`;

const ComparisonContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const StyledRadioGroup = styled(RadioGroup)`
  flex: 1;

  gap: 0;
  & > label {
    height: 33px;
  }
`;

export default ThresholdTypeForm;
