import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChatSettingsPanel } from '../chat-settings-panel'

function renderPanel(overrides: Partial<React.ComponentProps<typeof ChatSettingsPanel>> = {}) {
  const props: React.ComponentProps<typeof ChatSettingsPanel> = {
    panelRef: React.createRef<HTMLDivElement>(),
    onClose: jest.fn(),
    speakVoiceReplies: true,
    onSpeakVoiceRepliesChange: jest.fn(),
    speakTypedReplies: false,
    onSpeakTypedRepliesChange: jest.fn(),
    useRealtime: false,
    onRealtimeChange: jest.fn(),
    onDetectDevices: jest.fn(),
    isEnumerating: false,
    ttsVoice: 'Chloe',
    onVoiceChange: jest.fn(),
    micDeviceId: '',
    onMicChange: jest.fn(),
    devices: [],
    speakerDeviceId: '',
    onSpeakerChange: jest.fn(),
    ttsRate: 1,
    onRateChange: jest.fn(),
    isRealtimeActive: false,
    rtConnState: '',
    rtIceState: '',
    rtGatheringState: '',
    rtReconnecting: false,
    onReconnect: jest.fn(),
    ...overrides,
  }

  render(<ChatSettingsPanel {...props} />)
  return props
}

describe('ChatSettingsPanel', () => {
  it('keeps typed replies silent unless explicitly enabled', () => {
    renderPanel()

    expect(screen.getByLabelText('Speak voice replies')).toBeChecked()
    expect(screen.getByLabelText('Read typed replies aloud')).not.toBeChecked()
    expect(screen.getByText('Typed replies are silent by default.')).toBeInTheDocument()
  })

  it('reports independent voice and typed speech preference changes', () => {
    const onSpeakVoiceRepliesChange = jest.fn()
    const onSpeakTypedRepliesChange = jest.fn()
    renderPanel({ onSpeakVoiceRepliesChange, onSpeakTypedRepliesChange })

    fireEvent.click(screen.getByLabelText('Speak voice replies'))
    fireEvent.click(screen.getByLabelText('Read typed replies aloud'))

    expect(onSpeakVoiceRepliesChange).toHaveBeenCalledWith(false)
    expect(onSpeakTypedRepliesChange).toHaveBeenCalledWith(true)
  })
})
