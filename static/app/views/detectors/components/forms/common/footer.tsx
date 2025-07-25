import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

export function NewDetectorFooter() {
  const organization = useOrganization();

  return (
    <EditLayout.Footer label={t('Step 2 of 2')}>
      <LinkButton
        priority="default"
        to={`${makeMonitorBasePathname(organization.slug)}new/`}
      >
        {t('Back')}
      </LinkButton>
      <Button priority="primary" type="submit">
        {t('Create Monitor')}
      </Button>
    </EditLayout.Footer>
  );
}
