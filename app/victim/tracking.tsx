import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
import api, { API_URL, SOCKET_URL } from '../../lib/api';
import { useTranslations } from '../../lib/i18n/useTranslations';
import { useAudioRecorder } from '../../lib/useAudioRecorder';
import VictimBottomNav from '../../components/VictimBottomNav';
import {
  RiArrowLeftLine,
  RiShieldCheckFill,
  RiTimeLine,
  RiFileList3Line,
  RiShieldUserLine,
  RiTruckLine,
  RiCheckboxCircleLine,
  RiChatSmile2Line,
  RiPlayFill,
  RiPauseFill,
  RiMicFill,
  RiStopCircleFill,
  RiSendPlane2Fill,
  RiPhoneFill,
  RiDirectionLine,
  RiVideoUploadLine,
  RiMovieLine,
  RiEdit2Line,
  RiDeleteBinLine,
  RiCheckLine,
  RiCloseLine,
} from 'react-icons/ri';


const STATUS_STEP_MAP: Record<string, number> = {
  RECEIVED: 1,
  NEW: 1,
  EMERGENCY: 1,
  UNDER_REVIEW: 2,
  OFFICER_ASSIGNED: 3,
  SUPPORT_ASSIGNED: 3,
  FOLLOW_UP: 3,
  RESOLVED: 4,
};

export default function TrackingScreen() {
  const router = useRouter();
  const { caseId: paramCaseId } = useLocalSearchParams<{ caseId?: string }>();
  const { t, language } = useTranslations();
  const [caseData, setCaseData] = useState<any>(null);
  const [safetyAnswer, setSafetyAnswer] = useState<string>('yes');
  const [showConfirmBanner, setShowConfirmBanner] = useState<boolean>(false);

  // Chat State
  const [messages, setMessages] = useState<any[]>([]);
  const [textInput, setTextInput] = useState('');
  const [sending, setSending] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [recSeconds, setRecSeconds] = useState(0);

  // Video and Message Management State
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
  const [editMsgText, setEditMsgText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const recorder = useAudioRecorder();
  const timerRef = useRef<any>(null);
  const playingAudioRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const videoInputRef = useRef<any>(null);

  // 1. Initial Load & Case Setup
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        let activeId: number | null = paramCaseId ? Number(paramCaseId) : null;

        if (!activeId) {
          const cStr = await AsyncStorage.getItem('sahay_case');
          if (cStr) {
            const parsed = JSON.parse(cStr);
            if (parsed?.id) {
              activeId = Number(parsed.id);
              if (isMounted) setCaseData(parsed);
            }
          }
        }

        const saStr = await AsyncStorage.getItem('sahay_safety_answer');
        const bannerStr = await AsyncStorage.getItem('sahay_new_alert_banner');

        if (saStr) setSafetyAnswer(saStr);
        if (bannerStr === 'true') {
          setShowConfirmBanner(true);
          await AsyncStorage.removeItem('sahay_new_alert_banner');
        }

        if (activeId) {
          refreshCase(activeId);
          fetchMessages(activeId);
        } else {
          try {
            const alertsRes = await api.get('/api/victims/alerts');
            const target = alertsRes.data?.summary?.latest_active || alertsRes.data?.data?.[0];
            if (target?.id && isMounted) {
              setCaseData(target);
              refreshCase(target.id);
              fetchMessages(target.id);
            }
          } catch (_e) {}
        }
      } catch (_e) {}
    })();

    return () => {
      isMounted = false;
      if (socketRef.current) socketRef.current.disconnect();
      if (playingAudioRef.current) {
        try { playingAudioRef.current.pause(); } catch (_e) {}
      }
    };
  }, []);

  // 2. Setup Socket.IO for real-time messages and case status updates
  useEffect(() => {
    if (!caseData?.id) return;
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe_case', { caseId: caseData.id });
    });

    socket.on('new_message', (payload: any) => {
      if (Number(payload?.caseId) === Number(caseData?.id) && payload?.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.message.id)) return prev;
          return [...prev, payload.message];
        });
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });

    socket.on('case_updated', (payload: any) => {
      if (payload?.case && Number(payload.case.id) === Number(caseData?.id)) {
        setCaseData(payload.case);
        AsyncStorage.setItem('sahay_case', JSON.stringify(payload.case));
      }
    });

    socket.on('message_updated', (payload: any) => {
      if (Number(payload?.caseId) === Number(caseData?.id) && payload?.message) {
        setMessages((prev) =>
          prev.map((m) => (m.id === payload.message.id ? { ...m, ...payload.message } : m))
        );
      }
    });

    socket.on('message_deleted', (payload: any) => {
      if (Number(payload?.caseId) === Number(caseData?.id) && payload?.messageId) {
        setMessages((prev) => prev.filter((m) => m.id !== payload.messageId));
      }
    });

    // 4-second polling fallback to guarantee fresh updates
    const pollInterval = setInterval(() => {
      if (caseData?.id) {
        refreshCase(caseData.id);
        fetchMessages(caseData.id, false);
      }
    }, 4000);

    return () => {
      clearInterval(pollInterval);
      socket.disconnect();
    };
  }, [caseData?.id]);

  const refreshCase = async (id: number) => {
    try {
      const res = await api.get(`/api/cases/${id}`);
      const fresh = res.data?.data?.case;
      if (fresh) {
        setCaseData(fresh);
        await AsyncStorage.setItem('sahay_case', JSON.stringify(fresh));
      }
    } catch (_e) {}
  };

  const fetchMessages = async (caseId: number, scroll = true) => {
    try {
      const res = await api.get(`/api/messages?caseId=${caseId}`);
      const list = res.data?.data?.messages || [];
      setMessages(list);
      if (scroll && list.length > 0) {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (_e) {}
  };

  // 3. Send Text Message
  const handleSendText = async () => {
    if (!textInput.trim() || !caseData?.id || sending) return;
    const text = textInput.trim();
    setTextInput('');
    setSending(true);
    try {
      const res = await api.post('/api/messages/text', {
        caseId: caseData.id,
        message: text,
      });
      if (res.data?.data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === res.data.data.id)) return prev;
          return [...prev, res.data.data];
        });
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (_e) {
      setTextInput(text);
    } finally {
      setSending(false);
    }
  };

  // 4. Voice Recording & Sending
  const startVoiceRecording = async () => {
    const started = await recorder.start();
    if (started) {
      setRecSeconds(0);
      timerRef.current = setInterval(() => {
        setRecSeconds((s) => s + 1);
      }, 1000);
    }
  };

  const stopAndSendVoice = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const { blob, uri } = await recorder.stop();
    if (!caseData?.id) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('caseId', String(caseData.id));
      if (Platform.OS === 'web' && blob) {
        fd.append('audio', blob, `victim_msg_${Date.now()}.webm`);
      } else if (uri) {
        fd.append('audio', {
          uri,
          type: 'audio/webm',
          name: `victim_msg_${Date.now()}.webm`,
        } as any);
      }
      const res = await api.post('/api/messages/voice', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.data) {
        setMessages((prev) => [...prev, res.data.data]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (_e) {
    } finally {
      recorder.reset();
      setSending(false);
      setRecSeconds(0);
    }
  };

  // 5. Video Sharing
  const handleVideoSelected = async (e: any) => {
    const file = e.target?.files?.[0];
    if (!file || !caseData?.id) return;
    setUploadingVideo(true);
    try {
      const fd = new FormData();
      fd.append('caseId', String(caseData.id));
      fd.append('video', file);
      const res = await api.post('/api/messages/video', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.data) {
        setMessages((prev) => [...prev, res.data.data]);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to upload video. Please try again.';
      Alert.alert('Upload Error', msg);
    } finally {
      setUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  // 6. Message Edit and Delete Handlers
  const startEditMessage = (m: any) => {
    setEditingMsgId(m.id);
    setEditMsgText(m.message || '');
  };

  const cancelEditMessage = () => {
    setEditingMsgId(null);
    setEditMsgText('');
  };

  const handleSaveEdit = async (msgId: number) => {
    if (!editMsgText.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      const res = await api.patch(`/api/messages/${msgId}`, { message: editMsgText.trim() });
      if (res.data?.data) {
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, ...res.data.data } : m))
        );
      }
      setEditingMsgId(null);
    } catch (err: any) {
      Alert.alert('Edit Error', err.response?.data?.message || 'Unable to update message');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteMessage = async (msgId: number) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (!window.confirm('Are you sure you want to delete this message?')) return;
    }
    try {
      await api.delete(`/api/messages/${msgId}`);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch (err: any) {
      Alert.alert('Delete Error', err.response?.data?.message || 'Unable to delete message');
    }
  };

  // 5. Cross-Platform Audio Playback (Web Audio & Native expo-av)
  const playVoiceMessage = async (msg: any) => {
    try {
      if (playingAudioRef.current) {
        try {
          if (Platform.OS === 'web') {
            playingAudioRef.current.pause();
          } else {
            playingAudioRef.current.stopAsync?.();
            playingAudioRef.current.unloadAsync?.();
          }
        } catch (_err) {}
        playingAudioRef.current = null;
        if (playingId === msg.id) {
          setPlayingId(null);
          return;
        }
      }

      const audioUrl = msg.audio_url?.startsWith('http')
        ? msg.audio_url
        : `${API_URL}${msg.audio_url}`;

      if (Platform.OS === 'web' || typeof window !== 'undefined') {
        const audio = new Audio(audioUrl);
        playingAudioRef.current = audio;
        setPlayingId(msg.id);
        audio.onended = () => {
          setPlayingId(null);
          playingAudioRef.current = null;
        };
        audio.onerror = () => {
          setPlayingId(null);
          playingAudioRef.current = null;
        };
        audio.play().catch(() => {
          setPlayingId(null);
          playingAudioRef.current = null;
        });
      } else {
        const { Audio } = require('expo-av');
        const { sound } = await Audio.Sound.createAsync({ uri: audioUrl });
        playingAudioRef.current = sound;
        setPlayingId(msg.id);
        sound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.didJustFinish) {
            setPlayingId(null);
            playingAudioRef.current = null;
            sound.unloadAsync();
          }
        });
        await sound.playAsync();
      }
    } catch (_e) {
      setPlayingId(null);
    }
  };

  const isEmergency = safetyAnswer === 'yes' || caseData?.is_emergency;
  const stepKeys = isEmergency
    ? [
        'tracker.emergencyComplaintReceived',
        'tracker.emergencyEmergencyReviewed',
        'tracker.emergencySupportAssigned',
        'tracker.emergencyResolved',
      ]
    : [
        'tracker.unsureResponseSubmitted',
        'tracker.unsureOperatorReviewed',
        'tracker.unsureSupportAssigned',
        'tracker.unsureResolved',
      ];

  const currentStep = STATUS_STEP_MAP[caseData?.status] ?? 1;
  const isResolved = caseData?.status === 'RESOLVED';
  const hasOperatorAssigned = currentStep >= 3;

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const formatISTDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch (_e) {
      return isoString;
    }
  };

  return (
    <View style={styles.container}>
      {/* Sleek Top Header Bar with React Icons & Clean Spacing */}
      <View style={[styles.header, isEmergency && styles.headerEmergency]}>
        <TouchableOpacity
          style={styles.headerBackBtn}
          onPress={() => router.push('/victim/dashboard')}
          activeOpacity={0.7}
        >
          <RiArrowLeftLine size={20} color="#ffffff" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.headerBrandRow}>
            <RiShieldCheckFill size={15} color={isEmergency ? '#fecdd3' : '#38bdf8'} />
            <Text style={styles.headerTitle}>{t('common.appName')}</Text>
          </View>
          <Text style={styles.headerSub} numberOfLines={1}>
            {caseData?.id ? `Alert #${caseData.id} · ` : ''}
            {caseData?.case_number || (isEmergency ? t('tracker.selectionEmergency') : t('tracker.selectionUnsure'))}
          </Text>
        </View>

        <View style={[styles.headerStatusBadge, isEmergency && styles.headerStatusBadgeEmergency, isResolved && styles.headerStatusBadgeResolved]}>
          <View style={[styles.liveDot, { backgroundColor: isResolved ? '#22c55e' : isEmergency ? '#ef4444' : '#f59e0b' }]} />
          <Text style={styles.headerStatusText}>
            {isResolved ? 'RESOLVED' : (caseData?.status?.replace(/_/g, ' ') || 'EMERGENCY')}
          </Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.body}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Immediate Danger Confirmation Banner */}
        {showConfirmBanner && (
          <View style={styles.confirmationBanner}>
            <View style={styles.confirmDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.confirmTitle}>{t('emergencyBuzzer.alertTriggered')}</Text>
              <Text style={styles.confirmDesc}>{t('emergencyBuzzer.confirmationMessage')}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowConfirmBanner(false)} style={styles.dismissBtn}>
              <Text style={styles.dismissText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Case Info Summary Card */}
        {caseData && (
          <View style={styles.caseCard}>
            <View style={styles.caseRow}>
              <View>
                <Text style={styles.caseLabel}>{t('tracker.caseReference')}</Text>
                <Text style={styles.caseNumber}>{caseData.case_number || 'NHAA-PENDING'}</Text>
                {caseData.created_at && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                    <RiTimeLine size={13} color="#0369a1" />
                    <Text style={styles.caseDateText}>
                      {formatISTDate(caseData.created_at)} (IST)
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.livePulseWrap}>
                <View style={[styles.livePulseDot, isResolved && { backgroundColor: '#10b981' }]} />
                <Text style={styles.livePulseText}>
                  {isResolved ? t('tracker.completed') : t('chat.liveLabel')}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 4-Step Case Progress Tracker */}
        <View style={styles.trackerCard}>
          <Text style={styles.trackerHeading}>{t('tracker.caseProgress') || 'Case Progress'}</Text>

          {stepKeys.map((key, i) => {
            const stepNum = i + 1;
            const isDone = isResolved || stepNum <= currentStep;
            const isActive = !isResolved && stepNum === currentStep + 1;
            const isLast = i === stepKeys.length - 1;

            const stepTitle = stepNum === 1
              ? 'Emergency Complaint Received'
              : stepNum === 2
              ? 'Reviewed by Emergency Officer'
              : stepNum === 3
              ? 'Support Team Assigned'
              : 'Case Resolved';

            return (
              <View key={key} style={styles.stepRow}>
                <View style={styles.stepIndicatorCol}>
                  <View
                    style={[
                      styles.stepCircle,
                      isDone && styles.stepCircleDone,
                      isActive && styles.stepCircleActive,
                      !isDone && !isActive && styles.stepCirclePending,
                    ]}
                  >
                    {isDone ? (
                      <RiCheckboxCircleLine size={15} color="#ffffff" />
                    ) : isActive ? (
                      stepNum === 1 ? (
                        <RiFileList3Line size={13} color="#ffffff" />
                      ) : stepNum === 2 ? (
                        <RiShieldUserLine size={13} color="#ffffff" />
                      ) : stepNum === 3 ? (
                        <RiTruckLine size={13} color="#ffffff" />
                      ) : (
                        <RiCheckboxCircleLine size={13} color="#ffffff" />
                      )
                    ) : (
                      <Text style={styles.stepCircleTextPending}>{stepNum}</Text>
                    )}
                  </View>
                  {!isLast && (
                    <View style={[styles.stepLine, isDone && stepNum < currentStep && styles.stepLineDone]} />
                  )}
                </View>

                <View style={styles.stepContentCol}>
                  <Text
                    style={[
                      styles.stepLabel,
                      isDone && styles.stepLabelDone,
                      isActive && styles.stepLabelActive,
                      !isDone && !isActive && styles.stepLabelPending,
                    ]}
                  >
                    {stepTitle}
                  </Text>

                  {/* Step 1 details — Complaint Received */}
                  {stepNum === 1 && (
                    <View style={{ marginTop: 3 }}>
                      <Text style={styles.stepDesc}>
                        Your complaint has been received and registered.
                      </Text>
                      {caseData?.case_number && (
                        <Text style={[styles.stepDesc, { fontWeight: '700', color: '#0369a1', marginTop: 2 }]}>
                          Reference ID: {caseData.case_number}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Step 2 details — Operator Review */}
                  {stepNum === 2 && (
                    <Text style={styles.stepDesc}>
                      {isDone
                        ? 'An emergency support officer has reviewed your report and action is being taken.'
                        : isActive
                        ? 'Your complaint has been registered. An emergency support officer is reviewing your report.'
                        : 'Awaiting emergency officer review and live contact.'}
                    </Text>
                  )}

                  {/* Step 3 details — Support Assigned Structured Card */}
                  {stepNum === 3 && (
                    <View style={{ marginTop: 3 }}>
                      <Text style={styles.stepDesc}>
                        {isDone
                          ? (caseData?.assigned_department
                              ? `${caseData.assigned_department} has been assigned to assist with your emergency request.`
                              : 'Support team has been assigned to your case. Assistance is being coordinated.')
                          : isActive
                          ? 'Coordinating ground response team assignment...'
                          : 'Ground response team and designated officer assignment.'}
                      </Text>

                      {isDone && (
                        <View style={styles.assignedDispatchCard}>
                          <View style={styles.dispatchHeaderRow}>
                            <View style={styles.dispatchIconWrap}>
                              <RiShieldCheckFill size={20} color="#1a4d8f" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.dispatchCardTitle}>Support Team Assigned & Dispatched</Text>
                              <Text style={styles.dispatchCardSubtitle}>Authorized Response Details</Text>
                            </View>
                            <View style={styles.enRouteBadge}>
                              <RiDirectionLine size={11} color="#15803d" />
                              <Text style={styles.enRouteBadgeText}>EN ROUTE</Text>
                            </View>
                          </View>

                          <View style={styles.dispatchFieldGrid}>
                            <View style={styles.dispatchFieldItem}>
                              <Text style={styles.dispatchFieldLabel}>SELECTED DEPARTMENT</Text>
                              <Text style={styles.dispatchFieldValue}>
                                {caseData?.assigned_department || 'Police Quick Response Team (QRT)'}
                              </Text>
                            </View>
                            <View style={styles.dispatchFieldItem}>
                              <Text style={styles.dispatchFieldLabel}>ASSIGNED OFFICER</Text>
                              <Text style={styles.dispatchFieldValue}>
                                {caseData?.assigned_officer_name || caseData?.assigned_to_name || 'Insp. R. Sharma (QRT Team Alpha)'}
                              </Text>
                            </View>
                          </View>

                          {caseData?.victim_status_message ? (
                            <View style={styles.dispatchMessageBox}>
                              <Text style={styles.dispatchMessageLabel}>OFFICER STATUS UPDATE:</Text>
                              <Text style={styles.dispatchMessageText}>{caseData.victim_status_message}</Text>
                            </View>
                          ) : (
                            <View style={styles.assignedNoticeBox}>
                              <Text style={styles.assignedNoticeText}>
                                {t('tracker.reachingYouShortly') || 'Assistance is being coordinated. Stay calm, help is on the way.'}
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  )}

                  {/* Step 4 details — Case Resolved */}
                  {stepNum === 4 && (
                    <View style={{ marginTop: 3 }}>
                      {isDone ? (
                        <View style={styles.resolvedNoticeBox}>
                          <Text style={styles.resolvedNoticeText}>
                            Case Resolved
                          </Text>
                          <Text style={[styles.resolvedNoticeSub, { marginTop: 4, fontWeight: '600' }]}>
                            {caseData?.resolution_message ||
                              'Your emergency support request has been resolved. Please stay safe.'}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.stepDesc}>
                          {currentStep >= 3
                            ? 'Assistance in progress. When you are safe, please let us know via chat.'
                            : 'Case resolution following ground assistance and safety verification.'}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* LIVE CHAT INTERFACE — Victim ↔ Operator */}
        <View style={styles.chatSection}>
          <View style={styles.chatHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <RiChatSmile2Line size={18} color="#1a4d8f" />
              <Text style={styles.chatSectionTitle}>{t('chat.title')}</Text>
            </View>
            <View style={styles.chatHeaderRight}>
              <View style={styles.chatLiveDot} />
              <Text style={styles.chatLiveText}>{t('chat.liveLabel')}</Text>
            </View>
          </View>

          {/* Messages list */}
          <ScrollView
            ref={scrollRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
          >
            {messages.length === 0 ? (
              <View style={styles.emptyChatBox}>
                <Text style={styles.emptyChatText}>{t('chat.noMessages')}</Text>
              </View>
            ) : (
              messages.map((m) => {
                const isVictim = m.sender === 'victim';
                const isSystem = m.sender === 'system';

                if (isSystem) {
                  return (
                    <View key={m.id} style={styles.systemMsgWrap}>
                      <Text style={styles.systemMsgText}>{m.message}</Text>
                    </View>
                  );
                }

                return (
                  <View
                    key={m.id}
                    style={[
                      styles.msgBubbleWrap,
                      isVictim ? styles.msgVictimAlign : styles.msgOperatorAlign,
                    ]}
                  >
                    <View
                      style={[
                        styles.msgBubble,
                        isVictim ? styles.msgVictimBubble : styles.msgOperatorBubble,
                      ]}
                    >
                      <Text
                        style={[
                          styles.msgSenderLabel,
                          isVictim ? styles.msgVictimLabel : styles.msgOperatorLabel,
                        ]}
                      >
                        {isVictim ? t('chat.you') : t('chat.officer')}
                      </Text>

                      {editingMsgId === m.id ? (
                        <View style={styles.inlineEditWrap}>
                          <TextInput
                            style={styles.inlineEditInput}
                            value={editMsgText}
                            onChangeText={setEditMsgText}
                            multiline
                            autoFocus
                          />
                          <View style={styles.inlineEditActions}>
                            <TouchableOpacity
                              style={styles.inlineCancelBtn}
                              onPress={cancelEditMessage}
                              disabled={savingEdit}
                            >
                              <Text style={styles.inlineCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.inlineSaveBtn}
                              onPress={() => handleSaveEdit(m.id)}
                              disabled={savingEdit || !editMsgText.trim()}
                            >
                              {savingEdit ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Text style={styles.inlineSaveText}>Save</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : m.message_type === 'video' ? (
                        <View style={styles.videoBubbleWrap}>
                          {Platform.OS === 'web' ? (
                            <video
                              controls
                              playsInline
                              preload="metadata"
                              src={
                                m.media_url?.startsWith('http')
                                  ? m.media_url
                                  : `${API_URL}${m.media_url || m.audio_url}`
                              }
                              style={{
                                width: '100%',
                                maxWidth: 260,
                                maxHeight: 180,
                                borderRadius: 8,
                                backgroundColor: '#000000',
                              }}
                            />
                          ) : (
                            <Text style={{ color: '#fff', fontSize: 12 }}>[Video Available]</Text>
                          )}
                          <Text
                            style={[
                              styles.videoEvidenceLabel,
                              isVictim ? { color: 'rgba(255,255,255,0.85)' } : { color: '#334155' },
                            ]}
                          >
                            📹 Video Evidence Shared
                          </Text>
                        </View>
                      ) : m.message_type === 'voice' ? (
                        <View style={styles.audioMsgRow}>
                          <TouchableOpacity
                            style={styles.playBtn}
                            onPress={() => playVoiceMessage(m)}
                          >
                            {playingId === m.id ? (
                              <RiPauseFill size={15} color="#0f172a" />
                            ) : (
                              <RiPlayFill size={15} color="#0f172a" />
                            )}
                          </TouchableOpacity>
                          <Text
                            style={[
                              styles.audioLabel,
                              isVictim ? { color: '#ffffff' } : { color: '#0f172a' },
                            ]}
                          >
                            {playingId === m.id ? t('chat.playing') : t('chat.playVoice')}
                          </Text>
                        </View>
                      ) : (
                        <Text
                          style={[
                            styles.msgText,
                            isVictim ? styles.msgVictimText : styles.msgOperatorText,
                          ]}
                        >
                          {m.message}
                        </Text>
                      )}

                      <View style={styles.msgMetaRow}>
                        <Text
                          style={[
                            styles.msgTime,
                            isVictim ? styles.msgVictimTime : styles.msgOperatorTime,
                          ]}
                        >
                          {new Date(m.timestamp).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                            timeZone: 'Asia/Kolkata',
                          })}
                          {m.is_edited ? ' · (edited)' : ''}
                        </Text>

                        {/* Victim sent message management controls */}
                        {isVictim && m.message_type !== 'system' && editingMsgId !== m.id && (
                          <View style={styles.msgActionRow}>
                            {m.message_type === 'text' && (
                              <TouchableOpacity
                                style={styles.msgActionBtn}
                                onPress={() => startEditMessage(m)}
                              >
                                <RiEdit2Line size={13} color="rgba(255,255,255,0.8)" />
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              style={styles.msgActionBtn}
                              onPress={() => handleDeleteMessage(m.id)}
                            >
                              <RiDeleteBinLine size={13} color="rgba(255,255,255,0.8)" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Chat Controls (Text + Voice Recording) */}
          {!isResolved ? (
            <View style={styles.chatInputContainer}>
              {recorder.state === 'recording' && (
                <View style={styles.recordingStatusBar}>
                  <View style={styles.recPulseDot} />
                  <Text style={styles.recordingText}>
                    {t('chat.recordingVoice')} ({fmtTime(recSeconds)})
                  </Text>
                  <TouchableOpacity
                    style={styles.recStopBtn}
                    onPress={stopAndSendVoice}
                  >
                    <Text style={styles.recStopBtnText}>{t('chat.stopRecording')} & {t('chat.send')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {uploadingVideo && (
                <View style={styles.uploadingStatusBar}>
                  <ActivityIndicator size="small" color="#0284c7" style={{ marginRight: 6 }} />
                  <Text style={styles.uploadingText}>Uploading video evidence...</Text>
                </View>
              )}

              {/* Quick Safety Confirmation Action when Support Dispatched */}
              {currentStep >= 3 && !isResolved && (
                <View style={styles.safetyConfirmRow}>
                  <TouchableOpacity
                    style={styles.safetyConfirmBtn}
                    onPress={() => {
                      setTextInput('I am safe, thank you.');
                    }}
                    activeOpacity={0.8}
                  >
                    <RiShieldCheckFill size={14} color="#16a34a" />
                    <Text style={styles.safetyConfirmBtnText}>Quick Reply: "I am safe, thank you."</Text>
                  </TouchableOpacity>
                </View>
              )}

              {recorder.state !== 'recording' && (
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.inputField}
                    placeholder={t('chat.typeMessage')}
                    placeholderTextColor="#94a3b8"
                    value={textInput}
                    onChangeText={setTextInput}
                    multiline={false}
                    onSubmitEditing={handleSendText}
                    editable={!sending && !uploadingVideo}
                  />

                  {/* 1. Share Video Option */}
                  <TouchableOpacity
                    style={[styles.videoActionBtn, uploadingVideo && styles.actionBtnDisabled]}
                    onPress={() => videoInputRef.current?.click()}
                    disabled={sending || uploadingVideo}
                  >
                    {uploadingVideo ? (
                      <ActivityIndicator size="small" color="#0284c7" />
                    ) : (
                      <RiVideoUploadLine size={19} color="#0284c7" />
                    )}
                  </TouchableOpacity>

                  {/* Hidden Web Video File Input */}
                  {Platform.OS === 'web' && (
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/*"
                      style={{ display: 'none' }}
                      onChange={handleVideoSelected}
                    />
                  )}

                  {/* 2. Voice Recording Option */}
                  <TouchableOpacity
                    style={styles.voiceActionBtn}
                    onPress={startVoiceRecording}
                    disabled={sending || uploadingVideo}
                  >
                    <RiMicFill size={20} color="#1a4d8f" />
                  </TouchableOpacity>

                  {/* 3. Send Text Option */}
                  <TouchableOpacity
                    style={[
                      styles.sendActionBtn,
                      (!textInput.trim() || sending || uploadingVideo) && styles.sendActionBtnDisabled,
                    ]}
                    onPress={handleSendText}
                    disabled={!textInput.trim() || sending || uploadingVideo}
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <RiSendPlane2Fill size={16} color="#ffffff" />
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.closedChatNotice}>
              <Text style={styles.closedChatNoticeText}>{t('tracker.finalClosedNotice')}</Text>
            </View>
          )}
        </View>

        {/* Emergency Help Notice */}
        <View style={styles.emergencyContactCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <RiPhoneFill size={14} color="#dc2626" />
            <Text style={styles.emergencyContactHeading}>{t('tracker.needImmediateHelp')}</Text>
          </View>
          <View style={styles.emergencyContactRow}>
            <View style={styles.helplineChip}>
              <RiPhoneFill size={12} color="#1a4d8f" />
              <Text style={styles.emergencyContactNum}>{t('common.police112')}</Text>
            </View>
            <View style={styles.helplineChip}>
              <RiShieldCheckFill size={12} color="#1a4d8f" />
              <Text style={styles.emergencyContactNum}>{t('common.nhaa14566')}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Modern Bottom Icon Navigation */}
      <VictimBottomNav activeTab="tracking" caseId={caseData?.id} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    backgroundColor: '#0f3a6d',
    paddingTop: Platform.OS === 'web' ? 14 : 44,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerEmergency: { backgroundColor: '#991b1b' },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
  },
  headerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    marginTop: 1,
  },
  headerStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    flexShrink: 0,
  },
  headerStatusBadgeEmergency: {
    backgroundColor: 'rgba(254,226,226,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(254,205,211,0.4)',
  },
  headerStatusBadgeResolved: {
    backgroundColor: '#15803d',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  headerStatusText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  body: { flex: 1 },
  scrollContent: {
    padding: 16,
    paddingBottom: 85,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  helplineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  confirmationBanner: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  confirmDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#059669', marginTop: 5 },
  confirmTitle: { fontSize: 14, fontWeight: '700', color: '#065f46', marginBottom: 2 },
  confirmDesc: { fontSize: 13, color: '#047857', lineHeight: 18 },
  dismissBtn: { padding: 4 },
  dismissText: { fontSize: 14, color: '#059669', fontWeight: '700' },
  caseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  caseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  caseLabel: { fontSize: 11, fontWeight: '600', color: '#64748b', textTransform: 'uppercase' },
  caseNumber: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginTop: 2 },
  caseDateText: { fontSize: 12, fontWeight: '600', color: '#0369a1', marginTop: 4 },
  livePulseWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  livePulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  livePulseText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  trackerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  trackerHeading: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  stepRow: { flexDirection: 'row', gap: 14, minHeight: 48 },
  stepIndicatorCol: { alignItems: 'center', width: 28 },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: { borderColor: '#1a4d8f', backgroundColor: '#1a4d8f' },
  stepCircleDone: { borderColor: '#16a34a', backgroundColor: '#16a34a' },
  stepCirclePending: { borderColor: '#cbd5e1', backgroundColor: '#f8fafc' },
  stepCircleText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  stepCircleTextLight: { color: '#ffffff' },
  stepCircleTextPending: { fontSize: 11, fontWeight: '700', color: '#94a3b8' },
  stepLine: { flex: 1, width: 2, backgroundColor: '#e2e8f0', marginVertical: 4 },
  stepLineDone: { backgroundColor: '#16a34a' },
  stepContentCol: { flex: 1, paddingBottom: 16 },
  stepLabel: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  stepLabelActive: { color: '#1a4d8f', fontWeight: '700' },
  stepLabelDone: { color: '#16a34a', fontWeight: '700' },
  stepLabelPending: { color: '#64748b', fontWeight: '500' },
  safetyConfirmRow: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  safetyConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    borderColor: '#86efac',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  safetyConfirmBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803d',
  },
  stepDesc: { fontSize: 13, color: '#64748b', marginTop: 3, lineHeight: 18 },
  assignedDispatchCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  dispatchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  dispatchIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dispatchIconText: { fontSize: 16 },
  dispatchCardTitle: { fontSize: 13, fontWeight: '700', color: '#14532d' },
  dispatchCardSubtitle: { fontSize: 11, color: '#166534' },
  enRouteBadge: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  enRouteBadgeText: { fontSize: 10, fontWeight: '800', color: '#ffffff', letterSpacing: 0.5 },
  dispatchFieldGrid: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  dispatchFieldItem: {},
  dispatchFieldLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  dispatchFieldValue: { fontSize: 13, fontWeight: '700', color: '#0f172a', marginTop: 1 },
  dispatchMessageBox: {
    backgroundColor: '#ecfdf5',
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  dispatchMessageLabel: { fontSize: 10, fontWeight: '700', color: '#047857' },
  dispatchMessageText: { fontSize: 12, color: '#065f46', marginTop: 2, lineHeight: 16 },
  assignedNoticeBox: {
    backgroundColor: '#f0fdf4',
    borderLeftWidth: 3,
    borderLeftColor: '#16a34a',
    padding: 10,
    borderRadius: 6,
    marginTop: 6,
  },
  assignedNoticeText: { fontSize: 13, fontWeight: '600', color: '#166534', lineHeight: 18 },
  resolvedNoticeBox: {
    backgroundColor: '#ecfdf5',
    borderLeftWidth: 3,
    borderLeftColor: '#059669',
    padding: 10,
    borderRadius: 6,
    marginTop: 6,
  },
  resolvedNoticeText: { fontSize: 13, fontWeight: '700', color: '#065f46', lineHeight: 18 },
  resolvedNoticeSub: { fontSize: 11, color: '#047857', marginTop: 4 },
  chatSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    overflow: 'hidden',
  },
  chatHeader: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatSectionTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  chatHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chatLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  chatLiveText: { fontSize: 11, fontWeight: '600', color: '#16a34a', textTransform: 'uppercase' },
  messagesContainer: {
    padding: 14,
    height: 280,
    backgroundColor: '#fcfdfd',
  },
  messagesContent: {
    paddingBottom: 16,
  },
  emptyChatBox: { padding: 30, alignItems: 'center', justifyContent: 'center' },
  emptyChatText: { fontSize: 13, color: '#94a3b8', textAlign: 'center', fontStyle: 'italic' },
  systemMsgWrap: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 8,
    marginVertical: 4,
    alignSelf: 'center',
  },
  systemMsgText: { fontSize: 12, color: '#475569', textAlign: 'center' },
  msgBubbleWrap: { marginVertical: 6, flexDirection: 'row' },
  msgVictimAlign: { justifyContent: 'flex-end' },
  msgOperatorAlign: { justifyContent: 'flex-start' },
  msgBubble: {
    maxWidth: '82%',
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 14,
  },
  msgVictimBubble: { backgroundColor: '#0f3a6d', borderBottomRightRadius: 2 },
  msgOperatorBubble: { backgroundColor: '#f1f5f9', borderBottomLeftRadius: 2, borderWidth: 1, borderColor: '#e2e8f0' },
  msgSenderLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 3 },
  msgVictimLabel: { color: 'rgba(255,255,255,0.75)' },
  msgOperatorLabel: { color: '#0f3a6d' },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgVictimText: { color: '#ffffff' },
  msgOperatorText: { color: '#0f172a' },
  msgTime: { fontSize: 10, marginTop: 4, textAlign: 'right' },
  msgVictimTime: { color: 'rgba(255,255,255,0.6)' },
  msgOperatorTime: { color: '#94a3b8' },
  audioMsgRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnText: { color: '#0f172a', fontSize: 12, fontWeight: '700' },
  audioLabel: { fontSize: 13, fontWeight: '500' },
  chatInputContainer: {
    padding: 10,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputField: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0f172a',
  },
  voiceActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceActionBtnActive: { backgroundColor: '#fee2e2', borderColor: '#ef4444' },
  voiceActionBtnText: { fontSize: 16 },
  sendActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0f3a6d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendActionBtnDisabled: { opacity: 0.4 },
  sendActionBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  recordingStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  recPulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#dc2626' },
  recordingText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#991b1b' },
  recStopBtn: {
    backgroundColor: '#dc2626',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  recStopBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  closedChatNotice: {
    padding: 14,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  closedChatNoticeText: { fontSize: 12, color: '#64748b', fontStyle: 'italic' },
  emergencyContactCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    marginBottom: 16,
  },
  emergencyContactHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  emergencyContactRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emergencyContactNum: { fontSize: 13, fontWeight: '700', color: '#be123c' },
  emergencyContactDivider: { color: '#cbd5e1' },
  newReportBtn: {
    backgroundColor: '#0f3a6d',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  newReportBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  // Video & Edit Styles
  videoActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDisabled: { opacity: 0.5 },
  uploadingStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: 6,
  },
  uploadingText: { fontSize: 12, color: '#0369a1', fontWeight: '600' },
  videoBubbleWrap: { paddingVertical: 4 },
  videoEvidenceLabel: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  msgMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 8,
  },
  msgActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  msgActionBtn: {
    padding: 3,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 4,
  },
  inlineEditWrap: {
    width: '100%',
    minWidth: 200,
    maxWidth: 280,
  },
  inlineEditInput: {
    backgroundColor: '#ffffff',
    color: '#0f172a',
    borderRadius: 6,
    padding: 8,
    fontSize: 13,
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#94a3b8',
  },
  inlineEditActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 6,
  },
  inlineCancelBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 4,
  },
  inlineCancelText: { color: '#ffffff', fontSize: 11, fontWeight: '600' },
  inlineSaveBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#16a34a',
    borderRadius: 4,
  },
  inlineSaveText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
});
