import { Classes, Pre } from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';
import classNames from 'classnames';
import { Chapter } from 'js-slang/dist/types';
import _ from 'lodash';
import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import {
  beginDebuggerPause,
  beginInterruptExecution,
  debuggerReset,
  debuggerResume
} from 'src/commons/application/actions/InterpreterActions';
import { fetchSourcecastIndex } from 'src/features/sourceRecorder/sourcecast/SourcecastActions';
import {
  saveSourcecastData,
  setCodeDeltasToApply,
  setCurrentPlayerTime,
  setInputToApply,
  setSourcecastData,
  setSourcecastDuration
} from 'src/features/sourceRecorder/SourceRecorderActions';
import {
  deleteSourcecastEntry,
  recordInit,
  resetInputs,
  timerPause,
  timerReset,
  timerResume,
  timerStart,
  timerStop
} from 'src/features/sourceRecorder/sourcereel/SourcereelActions';

import { ExternalLibraryName } from '../../../commons/application/types/ExternalTypes';
import { ControlBarAutorunButtons } from '../../../commons/controlBar/ControlBarAutorunButtons';
import { ControlBarChapterSelect } from '../../../commons/controlBar/ControlBarChapterSelect';
import { ControlBarClearButton } from '../../../commons/controlBar/ControlBarClearButton';
import { ControlBarEvalButton } from '../../../commons/controlBar/ControlBarEvalButton';
import {
  convertEditorTabStateToProps,
  SourcecastEditorContainerProps
} from '../../../commons/editor/EditorContainer';
import SideContentDataVisualizer from '../../../commons/sideContent/SideContentDataVisualizer';
import SideContentEnvVisualizer from '../../../commons/sideContent/SideContentEnvVisualizer';
import { SideContentTab, SideContentType } from '../../../commons/sideContent/SideContentTypes';
import SourceRecorderControlBar, {
  SourceRecorderControlBarProps
} from '../../../commons/sourceRecorder/SourceRecorderControlBar';
import SourcecastTable from '../../../commons/sourceRecorder/SourceRecorderTable';
import { useTypedSelector } from '../../../commons/utils/Hooks';
import Workspace, { WorkspaceProps } from '../../../commons/workspace/Workspace';
import {
  browseReplHistoryDown,
  browseReplHistoryUp,
  changeSideContentHeight,
  clearReplOutput,
  navigateToDeclaration,
  promptAutocomplete,
  removeEditorTab,
  setEditorBreakpoint,
  toggleEditorAutorun,
  updateActiveEditorTabIndex,
  updateReplValue
} from '../../../commons/workspace/WorkspaceActions';
import { WorkspaceLocation } from '../../../commons/workspace/WorkspaceTypes';
import {
  CodeDelta,
  Input,
  KeyboardCommand,
  PlaybackData,
  PlaybackStatus,
  RecordingStatus
} from '../../../features/sourceRecorder/SourceRecorderTypes';
import SourcereelControlbar from './subcomponents/SourcereelControlbar';

type SourcereelProps = DispatchProps & StateProps;

export type DispatchProps = {
  handleChapterSelect: (chapter: Chapter) => void;
  handleEditorEval: () => void;
  handleEditorValueChange: (newEditorValue: string) => void;
  handleExternalSelect: (externalLibraryName: ExternalLibraryName) => void;
  handleRecordInput: (input: Input) => void;
  handleReplEval: () => void;
  handleSetIsEditorReadonly: (editorReadonly: boolean) => void;
  handleSetSourcecastStatus: (PlaybackStatus: PlaybackStatus) => void;
};

export type StateProps = {};

const workspaceLocation: WorkspaceLocation = 'sourcereel';

const Sourcereel: React.FC<SourcereelProps> = props => {
  const [selectedTab, setSelectedTab] = useState(SideContentType.sourcereel);
  const dispatch = useDispatch();

  const courseId = useTypedSelector(state => state.session.courseId);
  const { chapter: sourceChapter, variant: sourceVariant } = useTypedSelector(
    state => state.workspaces[workspaceLocation].context
  );
  const {
    audioUrl,
    currentPlayerTime,
    codeDeltasToApply,
    inputToApply,
    playbackDuration,
    playbackStatus,
    sourcecastIndex
  } = useTypedSelector(state => state.workspaces.sourcecast);
  const {
    isFolderModeEnabled,
    activeEditorTabIndex,
    editorTabs,
    // enableDebugging,
    externalLibrary: externalLibraryName,
    isDebugging,
    isEditorAutorun,
    isEditorReadonly,
    isRunning,
    output,
    playbackData,
    recordingStatus,
    replValue,
    sideContentHeight,
    timeElapsedBeforePause,
    timeResumed
  } = useTypedSelector(store => store.workspaces[workspaceLocation]);

  useEffect(() => {
    fetchSourcecastIndex('sourcecast');
  }, []);

  useEffect(() => {
    if (!inputToApply) {
      return;
    }

    switch (inputToApply.type) {
      case 'activeTabChange':
        setSelectedTab(inputToApply.data);
        break;
      case 'chapterSelect':
        props.handleChapterSelect(inputToApply.data);
        break;
      case 'externalLibrarySelect':
        props.handleExternalSelect(inputToApply.data);
        break;
      case 'forcePause':
        props.handleSetSourcecastStatus(PlaybackStatus.forcedPaused);
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputToApply]);

  const setActiveEditorTabIndex = React.useCallback(
    (activeEditorTabIndex: number | null) =>
      dispatch(updateActiveEditorTabIndex(workspaceLocation, activeEditorTabIndex)),
    [dispatch]
  );
  const removeEditorTabByIndex = React.useCallback(
    (editorTabIndex: number) => dispatch(removeEditorTab(workspaceLocation, editorTabIndex)),
    [dispatch]
  );

  const getTimerDuration = () => timeElapsedBeforePause + Date.now() - timeResumed;

  const handleRecordInit = () => {
    const initData: PlaybackData['init'] = {
      chapter: sourceChapter,
      externalLibrary: externalLibraryName,
      // TODO: Hardcoded to make use of the first editor tab. Rewrite after editor tabs are added.
      editorValue: editorTabs[0].value
    };
    dispatch(recordInit(initData, workspaceLocation));
  };

  const handleRecordPause = () =>
    props.handleRecordInput({
      time: getTimerDuration(),
      type: 'forcePause',
      data: null
    });

  const editorEvalHandler = () => {
    props.handleEditorEval();
    if (recordingStatus !== RecordingStatus.recording) {
      return;
    }
    props.handleRecordInput({
      time: getTimerDuration(),
      type: 'keyboardCommand',
      data: KeyboardCommand.run
    });
  };
  const autorunButtons = (
    <ControlBarAutorunButtons
      handleDebuggerPause={() => dispatch(beginDebuggerPause(workspaceLocation))}
      handleDebuggerResume={() => dispatch(debuggerResume(workspaceLocation))}
      handleDebuggerReset={() => dispatch(debuggerReset(workspaceLocation))}
      handleEditorEval={editorEvalHandler}
      handleInterruptEval={() => dispatch(beginInterruptExecution(workspaceLocation))}
      handleToggleEditorAutorun={() => dispatch(toggleEditorAutorun(workspaceLocation))}
      isEntrypointFileDefined={activeEditorTabIndex !== null}
      isDebugging={isDebugging}
      isEditorAutorun={isEditorAutorun}
      isRunning={isRunning}
      key="autorun"
    />
  );

  const chapterSelectHandler = ({ chapter }: { chapter: Chapter }, e: any) => {
    props.handleChapterSelect(chapter);
    if (recordingStatus !== RecordingStatus.recording) {
      return;
    }
    props.handleRecordInput({
      time: getTimerDuration(),
      type: 'chapterSelect',
      data: chapter
    });
  };

  const chapterSelect = (
    <ControlBarChapterSelect
      handleChapterSelect={chapterSelectHandler}
      isFolderModeEnabled={isFolderModeEnabled}
      sourceChapter={sourceChapter}
      sourceVariant={sourceVariant}
      key="chapter"
    />
  );

  const clearButton = (
    <ControlBarClearButton
      handleReplOutputClear={() => dispatch(clearReplOutput(workspaceLocation))}
      key="clear_repl"
    />
  );

  const evalButton = (
    <ControlBarEvalButton
      handleReplEval={props.handleReplEval}
      isRunning={isRunning}
      key="eval_repl"
    />
  );

  const editorContainerProps: SourcecastEditorContainerProps = {
    ..._.pick(props, 'handleEditorEval', 'handleEditorValueChange', 'handleRecordInput'),
    codeDeltasToApply: codeDeltasToApply,
    inputToApply: inputToApply,
    isEditorAutorun: isEditorAutorun,
    isEditorReadonly: isEditorReadonly,
    editorVariant: 'sourcecast',
    isFolderModeEnabled,
    activeEditorTabIndex,
    setActiveEditorTabIndex,
    removeEditorTabByIndex,
    editorTabs: editorTabs.map(convertEditorTabStateToProps),
    handleDeclarationNavigate: cursorPosition =>
      dispatch(navigateToDeclaration(workspaceLocation, cursorPosition)),
    // TODO: Hardcoded to make use of the first editor tab. Refactoring is needed for this workspace to enable Folder mode.
    handleEditorUpdateBreakpoints: newBreakpoints =>
      dispatch(setEditorBreakpoint(workspaceLocation, 0, newBreakpoints)),
    editorSessionId: '',
    getTimerDuration: getTimerDuration,
    isPlaying: playbackStatus === PlaybackStatus.playing,
    isRecording: recordingStatus === RecordingStatus.recording
  };

  const activeTabChangeHandler = (activeTab: SideContentType) => {
    setSelectedTab(activeTab);
    if (recordingStatus !== RecordingStatus.recording) {
      return;
    }
    props.handleRecordInput({
      time: getTimerDuration(),
      type: 'activeTabChange',
      data: activeTab
    });
  };

  const dataVisualizerTab: SideContentTab = {
    label: 'Data Visualizer',
    iconName: IconNames.EYE_OPEN,
    body: <SideContentDataVisualizer />,
    id: SideContentType.dataVisualizer
  };

  const envVisualizerTab: SideContentTab = {
    label: 'Env Visualizer',
    iconName: IconNames.GLOBE,
    body: <SideContentEnvVisualizer workspaceLocation={workspaceLocation} />,
    id: SideContentType.envVisualizer
  };

  const workspaceProps: WorkspaceProps = {
    controlBarProps: {
      editorButtons: [autorunButtons, chapterSelect]
    },
    editorContainerProps: editorContainerProps,
    handleSideContentHeightChange: heightChange =>
      dispatch(changeSideContentHeight(heightChange, workspaceLocation)),
    replProps: {
      output: output,
      replValue: replValue,
      handleBrowseHistoryDown: () => dispatch(browseReplHistoryDown(workspaceLocation)),
      handleBrowseHistoryUp: () => dispatch(browseReplHistoryUp(workspaceLocation)),
      handleReplEval: props.handleReplEval,
      handleReplValueChange: newValue => dispatch(updateReplValue(newValue, workspaceLocation)),
      sourceChapter: sourceChapter,
      sourceVariant: sourceVariant,
      externalLibrary: externalLibraryName,
      replButtons: [evalButton, clearButton]
    },
    sideBarProps: {
      tabs: []
    },
    sideContentHeight: sideContentHeight,
    sideContentProps: {
      onChange: activeTabChangeHandler,
      selectedTabId: selectedTab,
      /**
       * NOTE: An ag-grid console warning is shown here on load as the 'Sourcecast Table' tab
       * is not the default tab, and the ag-grid table inside it has not been rendered.
       * This is a known issue with ag-grid, and is okay since only staff and admins have
       * access to Sourcereel. For more info, see issue #1152 in frontend.
       */
      tabs: {
        beforeDynamicTabs: [
          {
            label: 'Recording Panel',
            iconName: IconNames.COMPASS,
            body: (
              <div>
                <span className="Multi-line">
                  <Pre> {INTRODUCTION} </Pre>
                </span>
                <SourcereelControlbar
                  currentPlayerTime={currentPlayerTime}
                  // TODO: Hardcoded to make use of the first editor tab. Rewrite after editor tabs are added.
                  editorValue={editorTabs[0].value}
                  getTimerDuration={getTimerDuration}
                  playbackData={playbackData}
                  handleRecordInit={handleRecordInit}
                  handleRecordPause={handleRecordPause}
                  handleResetInputs={(inputs: Input[]) =>
                    dispatch(resetInputs(inputs, workspaceLocation))
                  }
                  handleSaveSourcecastData={(title, description, uid, audio, playbackData) =>
                    dispatch(
                      saveSourcecastData(title, description, uid, audio, playbackData, 'sourcecast')
                    )
                  }
                  handleSetSourcecastData={(title, description, uid, audioUrl, playbackData) =>
                    dispatch(
                      setSourcecastData(
                        title,
                        description,
                        uid,
                        audioUrl,
                        playbackData,
                        'sourcecast'
                      )
                    )
                  }
                  handleSetIsEditorReadonly={props.handleSetIsEditorReadonly}
                  handleTimerPause={() => dispatch(timerPause(workspaceLocation))}
                  handleTimerReset={() => dispatch(timerReset(workspaceLocation))}
                  handleTimerResume={timeBefore =>
                    dispatch(timerResume(timeBefore, workspaceLocation))
                  }
                  handleTimerStart={() => dispatch(timerStart(workspaceLocation))}
                  handleTimerStop={() => dispatch(timerStop(workspaceLocation))}
                  recordingStatus={recordingStatus}
                />
              </div>
            ),
            id: SideContentType.sourcereel
          },
          {
            label: 'Sourcecast Table',
            iconName: IconNames.EDIT,
            body: (
              <div>
                <SourcecastTable
                  handleDeleteSourcecastEntry={id =>
                    dispatch(deleteSourcecastEntry(id, 'sourcecast'))
                  }
                  sourcecastIndex={sourcecastIndex}
                  courseId={courseId}
                />
              </div>
            ),
            id: SideContentType.introduction
          },
          dataVisualizerTab,
          envVisualizerTab
        ],
        afterDynamicTabs: []
      },
      workspaceLocation: 'sourcereel'
    }
  };
  const sourcecastControlbarProps: SourceRecorderControlBarProps = {
    ..._.pick(
      props,
      'handleEditorValueChange',
      'handleSetIsEditorReadonly',
      'handleSetSourcecastStatus',
      'handleChapterSelect',
      'handleExternalSelect'
    ),
    audioUrl: audioUrl,
    currentPlayerTime: currentPlayerTime,
    playbackData: playbackData,
    playbackStatus: playbackStatus,
    handleSetCurrentPlayerTime: playerTime =>
      dispatch(setCurrentPlayerTime(playerTime, 'sourcecast')),
    handleSetCodeDeltasToApply: (deltas: CodeDelta[]) =>
      dispatch(setCodeDeltasToApply(deltas, 'sourcecast')),
    handleSetInputToApply: (inputToApply: Input) =>
      dispatch(setInputToApply(inputToApply, 'sourcecast')),
    handleSetSourcecastDuration: duration =>
      dispatch(setSourcecastDuration(duration, 'sourcecast')),
    handlePromptAutocomplete: (row, col, callback) =>
      dispatch(promptAutocomplete(workspaceLocation, row, col, callback)),
    duration: playbackDuration
  };
  return (
    <div className={classNames('Sourcereel', Classes.DARK)}>
      {recordingStatus === RecordingStatus.paused ? (
        <SourceRecorderControlBar {...sourcecastControlbarProps} />
      ) : undefined}
      <Workspace {...workspaceProps} />
    </div>
  );
};

const INTRODUCTION = 'Welcome to Sourcereel!';

export default Sourcereel;
