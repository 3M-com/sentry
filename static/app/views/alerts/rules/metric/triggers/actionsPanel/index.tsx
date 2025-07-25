import {Fragment, PureComponent} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import {Select} from 'sentry/components/core/select';
import ListItem from 'sentry/components/list/listItem';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconAdd, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import removeAtArrayIndex from 'sentry/utils/array/removeAtArrayIndex';
import replaceAtArrayIndex from 'sentry/utils/array/replaceAtArrayIndex';
import {uniqueId} from 'sentry/utils/guid';
import withOrganization from 'sentry/utils/withOrganization';
import SentryAppRuleModal from 'sentry/views/alerts/rules/issue/sentryAppRuleModal';
import ActionSpecificTargetSelector from 'sentry/views/alerts/rules/metric/triggers/actionsPanel/actionSpecificTargetSelector';
import ActionTargetSelector from 'sentry/views/alerts/rules/metric/triggers/actionsPanel/actionTargetSelector';
import DeleteActionButton from 'sentry/views/alerts/rules/metric/triggers/actionsPanel/deleteActionButton';
import {
  type Action,
  type ActionType,
  AlertRuleComparisonType,
  type MetricActionTemplate,
  type Trigger,
} from 'sentry/views/alerts/rules/metric/types';
import {
  ActionLabel,
  DefaultPriorities,
  PriorityOptions,
  TargetLabel,
} from 'sentry/views/alerts/rules/metric/types';

type Props = {
  availableActions: MetricActionTemplate[] | null;
  comparisonType: AlertRuleComparisonType;
  currentProject: string;
  disabled: boolean;
  error: boolean;
  loading: boolean;
  onAdd: (triggerIndex: number, action: Action) => void;
  onChange: (triggerIndex: number, triggers: Trigger[], actions: Action[]) => void;
  organization: Organization;
  projects: Project[];
  triggers: Trigger[];
  className?: string;
};

/**
 * When a new action is added, all of its settings should be set to their default values.
 * @param actionConfig
 * @param dateCreated kept to maintain order of unsaved actions
 */
const getCleanAction = (actionConfig: any, dateCreated?: string): Action => {
  return {
    unsavedId: uniqueId(),
    unsavedDateCreated: dateCreated ?? new Date().toISOString(),
    type: actionConfig.type,
    targetType:
      actionConfig?.allowedTargetTypes && actionConfig.allowedTargetTypes.length > 0
        ? actionConfig.allowedTargetTypes[0]
        : null,
    targetIdentifier: actionConfig.sentryAppId || '',
    inputChannelId: null,
    integrationId: actionConfig.integrationId,
    sentryAppId: actionConfig.sentryAppId,
    options: actionConfig.options || null,
  };
};

/**
 * Actions have a type (e.g. email, slack, etc), but only some have
 * an integrationId (e.g. email is null). This helper creates a unique
 * id based on the type and integrationId so that we know what action
 * a user's saved action corresponds to.
 */
const getActionUniqueKey = ({
  type,
  integrationId,
  sentryAppId,
}: Pick<Action, 'type' | 'integrationId' | 'sentryAppId'>) => {
  if (integrationId) {
    return `${type}-${integrationId}`;
  }
  if (sentryAppId) {
    return `${type}-${sentryAppId}`;
  }
  return type;
};

/**
 * Creates a human-friendly display name for the integration based on type and
 * server provided `integrationName`
 *
 * e.g. for slack we show that it is slack and the `integrationName` is the workspace name
 */
const getFullActionTitle = ({
  type,
  integrationName,
  sentryAppName,
  status,
}: Pick<
  MetricActionTemplate,
  'type' | 'integrationName' | 'sentryAppName' | 'status'
>) => {
  if (sentryAppName) {
    if (status && status !== 'published') {
      return `${sentryAppName} (${status})`;
    }
    return `${sentryAppName}`;
  }

  const label = ActionLabel[type];
  if (integrationName) {
    return `${label} - ${integrationName}`;
  }
  return label;
};

/**
 * Lists saved actions as well as control to add a new action
 */
class ActionsPanel extends PureComponent<Props> {
  handleChangeKey(
    triggerIndex: number,
    index: number,
    key: 'targetIdentifier' | 'inputChannelId',
    value: string
  ) {
    const {triggers, onChange} = this.props;
    const {actions} = triggers[triggerIndex]!;
    const newAction = {
      ...actions[index]!,
      [key]: value,
    };

    onChange(triggerIndex, triggers, replaceAtArrayIndex(actions, index, newAction));
  }

  conditionallyRenderHelpfulBanner(triggerIndex: number, index: number) {
    const {triggers} = this.props;
    const {actions} = triggers[triggerIndex]!;
    const newAction = {...actions[index]};
    if (newAction.type === 'slack') {
      return (
        <FooterAlert
          type="info"
          trailingItems={
            <ExternalLink href="https://docs.sentry.io/product/integrations/notification-incidents/slack/#rate-limiting-error">
              {t('Learn More')}
            </ExternalLink>
          }
        >
          {t('Having rate limiting problems? Enter a channel or user ID.')}
        </FooterAlert>
      );
    }
    if (newAction.type === 'discord') {
      return (
        <FooterAlert
          type="info"
          trailingItems={
            <ExternalLink href="https://docs.sentry.io/product/accounts/early-adopter-features/discord/#issue-alerts">
              {t('Learn More')}
            </ExternalLink>
          }
        >
          {t('Note that you must enter a Discord channel ID, not a channel name.')}
        </FooterAlert>
      );
    }
    return null;
  }

  handleAddAction = () => {
    const {availableActions, onAdd} = this.props;
    const actionConfig = availableActions?.[0];

    if (!actionConfig) {
      addErrorMessage(t('There was a problem adding an action'));
      Sentry.captureException(new Error('Unable to add an action'));
      return;
    }

    const action: Action = getCleanAction(actionConfig);

    // Add new actions to critical by default
    const triggerIndex = 0;
    onAdd(triggerIndex, action);
  };

  handleDeleteAction = (triggerIndex: number, index: number) => {
    const {triggers, onChange} = this.props;
    const {actions} = triggers[triggerIndex]!;

    onChange(triggerIndex, triggers, removeAtArrayIndex(actions, index));
  };

  handleChangeActionLevel = (
    triggerIndex: number,
    index: number,
    value: SelectValue<number>
  ) => {
    const {triggers, onChange} = this.props;
    // Convert saved action to unsaved by removing id
    const {id: _, ...action} = triggers[triggerIndex]!.actions[index]!;
    action.unsavedId = uniqueId();
    triggers[value.value]!.actions.push(action);
    onChange(value.value, triggers, triggers[value.value]!.actions);
    this.handleDeleteAction(triggerIndex, index);
  };

  handleChangeActionType = (
    triggerIndex: number,
    index: number,
    value: SelectValue<ActionType>
  ) => {
    const {triggers, onChange, availableActions} = this.props;
    const {actions} = triggers[triggerIndex]!;
    const actionConfig = availableActions?.find(
      availableAction => getActionUniqueKey(availableAction) === value.value
    );
    if (!actionConfig) {
      addErrorMessage(t('There was a problem changing an action'));
      Sentry.captureException(new Error('Unable to change an action type'));
      return;
    }

    const existingDateCreated =
      actions[index]!.dateCreated ?? actions[index]!.unsavedDateCreated;
    const newAction: Action = getCleanAction(actionConfig, existingDateCreated);
    onChange(triggerIndex, triggers, replaceAtArrayIndex(actions, index, newAction));
  };

  handleChangeTarget = (
    triggerIndex: number,
    index: number,
    value: SelectValue<keyof typeof TargetLabel>
  ) => {
    const {triggers, onChange} = this.props;
    const {actions} = triggers[triggerIndex]!;
    const newAction = {
      ...actions[index]!,
      targetType: value.value,
      targetIdentifier: '',
    };

    onChange(triggerIndex, triggers, replaceAtArrayIndex(actions, index, newAction));
  };

  handleChangePriority = (
    triggerIndex: number,
    index: number,
    value: SelectValue<keyof typeof PriorityOptions>
  ) => {
    const {triggers, onChange} = this.props;
    const {actions} = triggers[triggerIndex]!;
    const newAction = {
      ...actions[index]!,
      priority: value.value,
    };

    onChange(triggerIndex, triggers, replaceAtArrayIndex(actions, index, newAction));
  };

  /**
   * Update the Trigger's Action fields from the SentryAppRuleModal together
   * only after the user clicks "Save Changes".
   * @param formData Form data
   */
  updateParentFromSentryAppRule = (
    triggerIndex: number,
    actionIndex: number,
    formData: Record<string, string>
  ): void => {
    const {triggers, onChange} = this.props;
    const {actions} = triggers[triggerIndex]!;
    const newAction = {
      ...actions[actionIndex]!,
      ...formData,
    };

    onChange(
      triggerIndex,
      triggers,
      replaceAtArrayIndex(actions, actionIndex, newAction)
    );
  };

  render() {
    const {
      availableActions,
      currentProject,
      disabled,
      loading,
      organization,
      projects,
      triggers,
      comparisonType,
    } = this.props;

    const project = projects.find(({slug}) => slug === currentProject);
    const items = availableActions?.map(availableAction => ({
      value: getActionUniqueKey(availableAction),
      label: getFullActionTitle(availableAction),
    }));

    const levels = [
      {value: 0, label: 'Critical Status'},
      {value: 1, label: 'Warning Status'},
    ];

    // NOTE: we don't support warning triggers for anomaly detection alerts yet
    // once we do, this can be deleted
    const anomalyDetectionLevels = [{value: 0, label: 'Critical Status'}];

    // Create single array of unsaved and saved trigger actions
    // Sorted by date created ascending
    const actions = triggers
      .flatMap((trigger, triggerIndex) => {
        return trigger.actions.map((action, actionIdx) => {
          const availableAction = availableActions?.find(
            a => getActionUniqueKey(a) === getActionUniqueKey(action)
          );
          return {
            dateCreated: new Date(
              action.dateCreated ?? action.unsavedDateCreated
            ).getTime(),
            triggerIndex,
            action,
            actionIdx,
            availableAction,
          };
        });
      })
      .sort((a, b) => a.dateCreated - b.dateCreated);

    return (
      <Fragment>
        <PerformActionsListItem>{t('Set actions')}</PerformActionsListItem>
        {loading && <LoadingIndicator />}
        {actions.map(({action, actionIdx, triggerIndex, availableAction}) => {
          const actionDisabled =
            triggers[triggerIndex]!.actions[actionIdx]?.disabled || disabled;
          return (
            <div key={action.id ?? action.unsavedId}>
              <RuleRowContainer>
                <PanelItemGrid>
                  <PanelItemSelects>
                    <Select
                      name="select-level"
                      aria-label={t('Select a status level')}
                      isDisabled={disabled || loading}
                      placeholder={t('Select Level')}
                      onChange={this.handleChangeActionLevel.bind(
                        this,
                        triggerIndex,
                        actionIdx
                      )}
                      value={triggerIndex}
                      options={
                        comparisonType === AlertRuleComparisonType.DYNAMIC
                          ? anomalyDetectionLevels
                          : levels
                      }
                    />
                    <Select
                      name="select-action"
                      aria-label={t('Select an Action')}
                      isDisabled={disabled || loading}
                      placeholder={t('Select Action')}
                      onChange={this.handleChangeActionType.bind(
                        this,
                        triggerIndex,
                        actionIdx
                      )}
                      value={getActionUniqueKey(action)}
                      options={items ?? []}
                    />

                    {availableAction && availableAction.allowedTargetTypes.length > 1 ? (
                      <Select
                        isDisabled={disabled || loading}
                        value={action.targetType}
                        options={availableAction?.allowedTargetTypes?.map(
                          allowedType => ({
                            value: allowedType,
                            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                            label: TargetLabel[allowedType],
                          })
                        )}
                        onChange={this.handleChangeTarget.bind(
                          this,
                          triggerIndex,
                          actionIdx
                        )}
                      />
                    ) : availableAction &&
                      availableAction.type === 'sentry_app' &&
                      availableAction.settings ? (
                      <Button
                        icon={<IconSettings />}
                        disabled={actionDisabled}
                        onClick={() => {
                          openModal(
                            deps => (
                              <SentryAppRuleModal
                                {...deps}
                                // Using ! for keys that will exist for sentryapps
                                sentryAppInstallationUuid={
                                  availableAction.sentryAppInstallationUuid!
                                }
                                config={availableAction.settings!}
                                appName={availableAction.sentryAppName!}
                                onSubmitSuccess={this.updateParentFromSentryAppRule.bind(
                                  this,
                                  triggerIndex,
                                  actionIdx
                                )}
                                resetValues={
                                  triggers[triggerIndex]!.actions[actionIdx] || {}
                                }
                              />
                            ),
                            {closeEvents: 'escape-key'}
                          );
                        }}
                      >
                        {t('Settings')}
                      </Button>
                    ) : null}
                    <ActionTargetSelector
                      action={action}
                      availableAction={availableAction}
                      disabled={disabled}
                      loading={loading}
                      onChange={this.handleChangeKey.bind(
                        this,
                        triggerIndex,
                        actionIdx,
                        'targetIdentifier'
                      )}
                      organization={organization}
                      project={project}
                    />
                    <ActionSpecificTargetSelector
                      action={action}
                      disabled={disabled}
                      onChange={this.handleChangeKey.bind(
                        this,
                        triggerIndex,
                        actionIdx,
                        'inputChannelId'
                      )}
                    />
                    {availableAction &&
                    (availableAction.type === 'opsgenie' ||
                      availableAction.type === 'pagerduty') ? (
                      <Select
                        isDisabled={disabled || loading}
                        value={action.priority}
                        placeholder={
                          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                          DefaultPriorities[availableAction.type][triggerIndex]
                        }
                        options={PriorityOptions[availableAction.type].map(priority => ({
                          value: priority,
                          label: priority,
                        }))}
                        onChange={this.handleChangePriority.bind(
                          this,
                          triggerIndex,
                          actionIdx
                        )}
                      />
                    ) : null}
                  </PanelItemSelects>
                  <DeleteActionButton
                    triggerIndex={triggerIndex}
                    index={actionIdx}
                    onClick={this.handleDeleteAction}
                    disabled={disabled}
                  />
                </PanelItemGrid>
              </RuleRowContainer>
              {this.conditionallyRenderHelpfulBanner(triggerIndex, actionIdx)}
            </div>
          );
        })}
        <ActionSection>
          <Button
            disabled={disabled || loading}
            icon={<IconAdd isCircled color="gray300" />}
            onClick={this.handleAddAction}
          >
            {t('Add Action')}
          </Button>
        </ActionSection>
      </Fragment>
    );
  }
}

const ActionsPanelWithSpace = styled(ActionsPanel)`
  margin-top: ${space(4)};
`;

const ActionSection = styled('div')`
  margin-top: ${space(1)};
  margin-bottom: ${space(3)};
`;

const PanelItemGrid = styled(PanelItem)`
  display: flex;
  align-items: center;
  border-bottom: 0;
  padding: ${space(1)};
`;

const PanelItemSelects = styled('div')`
  display: flex;
  width: 100%;
  margin-right: ${space(1)};
  > * {
    flex: 0 1 200px;

    &:not(:last-child) {
      margin-right: ${space(1)};
    }
  }
`;

const RuleRowContainer = styled('div')`
  background-color: ${p => p.theme.backgroundSecondary};
  border: 1px ${p => p.theme.border} solid;
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  &:last-child {
    border-radius: ${p => p.theme.borderRadius};
  }
`;

const StyledListItem = styled(ListItem)`
  margin: ${space(2)} 0 ${space(3)} 0;
  font-size: ${p => p.theme.fontSize.xl};
`;

const PerformActionsListItem = styled(StyledListItem)`
  margin-bottom: 0;
  line-height: 1.3;
`;

const FooterAlert = styled(Alert)`
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  margin-top: -1px; /* remove double border on panel bottom */
  a {
    white-space: nowrap;
  }
`;

export default withOrganization(ActionsPanelWithSpace);
