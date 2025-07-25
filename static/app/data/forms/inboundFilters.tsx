import {Fragment} from 'react';

import {ExternalLink} from 'sentry/components/core/link';
import type {Field, JsonFormObject} from 'sentry/components/forms/types';
import {t, tct} from 'sentry/locale';

// Export route to make these forms searchable by label/help
export const route = '/settings/:orgId/projects/:projectId/filters/';

const newLineHelpText = t('Separate multiple entries with a newline.');
const globHelpText = tct('Allows [link:glob pattern matching].', {
  link: <ExternalLink href="https://en.wikipedia.org/wiki/Glob_(programming)" />,
});

export const getOptionsData = (data: Record<PropertyKey, unknown>) => ({options: data});

const formGroups: JsonFormObject[] = [
  {
    // Form "section"/"panel"
    title: t('Custom Filters'),
    fields: [
      {
        name: 'filters:blacklisted_ips',
        type: 'string',
        saveOnBlur: false,
        saveMessage: t('Changing this filter will apply to all new events.'),
        monospace: true,
        multiline: true,
        autosize: true,
        rows: 1,
        maxRows: 10,

        placeholder: 'e.g. 127.0.0.1 or 10.0.0.0/8',
        label: t('IP Addresses'),
        help: (
          <Fragment>
            {t('Filter events from these IP addresses. ')}
            {newLineHelpText}
          </Fragment>
        ),
        getData: getOptionsData,
      },
    ],
  },
];

export default formGroups;

// These require a feature flag
export const customFilterFields: Field[] = [
  {
    name: 'filters:releases',
    type: 'string',
    saveOnBlur: false,
    saveMessage: t('Changing this filter will apply to all new events.'),
    monospace: true,
    multiline: true,
    autosize: true,
    maxRows: 10,
    rows: 1,

    placeholder: 'e.g. 1.* or [!3].[0-9].*',
    label: t('Releases'),
    help: (
      <Fragment>
        {t('Filter events from these releases. ')}
        {newLineHelpText} {globHelpText}
      </Fragment>
    ),
    getData: getOptionsData,
  },

  {
    name: 'filters:error_messages',
    type: 'string',
    saveOnBlur: false,
    saveMessage: t('Changing this filter will apply to all new events.'),
    monospace: true,
    multiline: true,
    autosize: true,
    maxRows: 10,
    rows: 1,

    placeholder: 'e.g. TypeError* or *: integer division or modulo by zero',
    label: t('Error Message'),
    help: (
      <Fragment>
        {t('Filter events by error messages. ')}
        {newLineHelpText} {globHelpText}{' '}
        {t('Exceptions are matched on "<type>: <message>", for example "TypeError: *".')}
      </Fragment>
    ),
    getData: getOptionsData,
  },
];
