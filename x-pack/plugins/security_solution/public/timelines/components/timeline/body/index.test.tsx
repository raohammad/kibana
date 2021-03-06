/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import { ReactWrapper } from 'enzyme';
import React from 'react';

import '../../../../common/mock/match_media';
import { mockBrowserFields } from '../../../../common/containers/source/mock';
import { Direction } from '../../../../../common/search_strategy';
import { defaultHeaders, mockTimelineData, mockTimelineModel } from '../../../../common/mock';
import { TestProviders } from '../../../../common/mock/test_providers';

import { Body, BodyProps } from '.';
import { columnRenderers, rowRenderers } from './renderers';
import { Sort } from './sort';
import { waitFor } from '@testing-library/react';
import { useMountAppended } from '../../../../common/utils/use_mount_appended';
import { SELECTOR_TIMELINE_BODY_CLASS_NAME, TimelineBody } from '../styles';

const mockGetNotesByIds = (eventId: string[]) => [];
const mockSort: Sort = {
  columnId: '@timestamp',
  sortDirection: Direction.desc,
};

jest.mock('../../../../common/hooks/use_selector', () => ({
  useShallowEqualSelector: jest.fn().mockReturnValue(mockTimelineModel),
  useDeepEqualSelector: jest.fn().mockReturnValue(mockTimelineModel),
}));

jest.mock('../../../../common/components/link_to');

// Prevent Resolver from rendering
jest.mock('../../graph_overlay');

jest.mock(
  'react-visibility-sensor',
  () => ({ children }: { children: (args: { isVisible: boolean }) => React.ReactNode }) =>
    children({ isVisible: true })
);

jest.mock('../../../../common/lib/helpers/scheduler', () => ({
  requestIdleCallbackViaScheduler: (callback: () => void, opts?: unknown) => {
    callback();
  },
  maxDelay: () => 3000,
}));

describe('Body', () => {
  const mount = useMountAppended();
  const props: BodyProps = {
    addNoteToEvent: jest.fn(),
    browserFields: mockBrowserFields,
    columnHeaders: defaultHeaders,
    columnRenderers,
    data: mockTimelineData,
    docValueFields: [],
    eventIdToNoteIds: {},
    isSelectAllChecked: false,
    getNotesByIds: mockGetNotesByIds,
    loadingEventIds: [],
    onColumnRemoved: jest.fn(),
    onColumnResized: jest.fn(),
    onColumnSorted: jest.fn(),
    onPinEvent: jest.fn(),
    onRowSelected: jest.fn(),
    onSelectAll: jest.fn(),
    onUnPinEvent: jest.fn(),
    onUpdateColumns: jest.fn(),
    pinnedEventIds: {},
    refetch: jest.fn(),
    rowRenderers,
    selectedEventIds: {},
    show: true,
    sort: mockSort,
    showCheckboxes: false,
    timelineId: 'timeline-test',
    toggleColumn: jest.fn(),
    updateNote: jest.fn(),
  };

  describe('rendering', () => {
    test('it renders the column headers', () => {
      const wrapper = mount(
        <TestProviders>
          <Body {...props} />
        </TestProviders>
      );

      expect(wrapper.find('[data-test-subj="column-headers"]').first().exists()).toEqual(true);
    });

    test('it renders the scroll container', () => {
      const wrapper = mount(
        <TestProviders>
          <Body {...props} />
        </TestProviders>
      );

      expect(wrapper.find('[data-test-subj="timeline-body"]').first().exists()).toEqual(true);
    });

    test('it renders events', () => {
      const wrapper = mount(
        <TestProviders>
          <Body {...props} />
        </TestProviders>
      );

      expect(wrapper.find('[data-test-subj="events"]').first().exists()).toEqual(true);
    });

    test('it renders a tooltip for timestamp', async () => {
      const headersJustTimestamp = defaultHeaders.filter((h) => h.id === '@timestamp');
      const testProps = { ...props, columnHeaders: headersJustTimestamp };
      const wrapper = mount(
        <TestProviders>
          <Body {...testProps} />
        </TestProviders>
      );
      wrapper.update();
      await waitFor(() => {
        wrapper.update();
        headersJustTimestamp.forEach(() => {
          expect(
            wrapper
              .find('[data-test-subj="data-driven-columns"]')
              .first()
              .find('[data-test-subj="localized-date-tool-tip"]')
              .exists()
          ).toEqual(true);
        });
      });
    }, 20000);

    test(`it add attribute data-timeline-id in ${SELECTOR_TIMELINE_BODY_CLASS_NAME}`, () => {
      const wrapper = mount(
        <TestProviders>
          <Body {...props} />
        </TestProviders>
      );
      expect(
        wrapper
          .find(`[data-timeline-id="timeline-test"].${SELECTOR_TIMELINE_BODY_CLASS_NAME}`)
          .first()
          .exists()
      ).toEqual(true);
    });
    describe('when there is a graphEventId', () => {
      beforeEach(() => {
        props.graphEventId = 'graphEventId'; // any string w/ length > 0 works
      });
      it('should not render the timeline body', () => {
        const wrapper = mount(
          <TestProviders>
            <Body {...props} />
          </TestProviders>
        );

        // The value returned if `wrapper.find` returns a `TimelineBody` instance.
        type TimelineBodyEnzymeWrapper = ReactWrapper<React.ComponentProps<typeof TimelineBody>>;

        // The first TimelineBody component
        const timelineBody: TimelineBodyEnzymeWrapper = wrapper
          .find('[data-test-subj="timeline-body"]')
          .first() as TimelineBodyEnzymeWrapper;

        // the timeline body still renders, but it gets a `display: none` style via `styled-components`.
        expect(timelineBody.props().visible).toBe(false);
      });
    });
  });

  describe('action on event', () => {
    const dispatchAddNoteToEvent = jest.fn();
    const dispatchOnPinEvent = jest.fn();
    const testProps = {
      ...props,
      addNoteToEvent: dispatchAddNoteToEvent,
      onPinEvent: dispatchOnPinEvent,
    };

    const addaNoteToEvent = (wrapper: ReturnType<typeof mount>, note: string) => {
      wrapper.find('[data-test-subj="add-note"]').first().find('button').simulate('click');
      wrapper.update();
      wrapper
        .find('[data-test-subj="new-note-tabs"] textarea')
        .simulate('change', { target: { value: note } });
      wrapper.update();
      wrapper.find('button[data-test-subj="add-note"]').first().simulate('click');
      wrapper.update();
    };

    beforeEach(() => {
      dispatchAddNoteToEvent.mockClear();
      dispatchOnPinEvent.mockClear();
    });

    test('Add a Note to an event', () => {
      const wrapper = mount(
        <TestProviders>
          <Body {...testProps} />
        </TestProviders>
      );
      addaNoteToEvent(wrapper, 'hello world');

      expect(dispatchAddNoteToEvent).toHaveBeenCalled();
      expect(dispatchOnPinEvent).toHaveBeenCalled();
    });

    test('Add two Note to an event', () => {
      const Proxy = (proxyProps: BodyProps) => (
        <TestProviders>
          <Body {...proxyProps} />
        </TestProviders>
      );

      const wrapper = mount(<Proxy {...testProps} />);
      addaNoteToEvent(wrapper, 'hello world');
      dispatchAddNoteToEvent.mockClear();
      dispatchOnPinEvent.mockClear();
      wrapper.setProps({ pinnedEventIds: { 1: true } });
      wrapper.update();
      addaNoteToEvent(wrapper, 'new hello world');
      expect(dispatchAddNoteToEvent).toHaveBeenCalled();
      expect(dispatchOnPinEvent).not.toHaveBeenCalled();
    });
  });
});
