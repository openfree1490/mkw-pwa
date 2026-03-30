// ── $5K OPTIONS CHALLENGE — Main Container ────────────────────────────────
import { useState, useCallback } from 'react'
import { CHALLENGE, CC, FONTS, TIERS } from './engine/constants.js'
import { useStorage, resetAllChallengeData } from './hooks/useStorage.js'
import CommandTab from './tabs/CommandTab.jsx'
import WatchlistTab from './tabs/WatchlistTab.jsx'
import IdeasTab from './tabs/IdeasTab.jsx'
import TradesTab from './tabs/TradesTab.jsx'
import SizerTab from './tabs/SizerTab.jsx'
import RiskTab from './tabs/RiskTab.jsx'
import DebriefTab from './tabs/DebriefTab.jsx'
import PlaybookTab from './tabs/PlaybookTab.jsx'
import GradingTab from './tabs/GradingTab.jsx'
import AlertsTab from './tabs/AlertsTab.jsx'

const FONT_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"

const TABS = [
  { key: 'command', label: 'CMD', icon: '◈' },
  { key: 'grading', label: 'GRADE', icon: '◆' },
  { key: 'alerts', label: 'ALERTS', icon: '⚡' },
  { key: 'watchlist', label: 'WATCH', icon: '◉' },
  { key: 'ideas', label: 'IDEAS', icon: '★' },
  { key: 'trades', label: 'TRADES', icon: '▲' },
  { key: 'sizer', label: 'SIZER', icon: '◊' },
  { key: 'risk', label: 'RISK', icon: '⊘' },
  { key: 'debrief', label: 'DEBRIEF', icon: '✎' },
  { key: 'playbook', label: 'BOOK', icon: '▣' },
]

function getTier(balance) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (balance >= TIERS[i].range[0]) return i
  }
  return 0
}

// Settings tab inline
function SettingsPanel({ apiKey, setApiKey, balance, setBalance, setBalanceHistory }) {
  const [keyInput, setKeyInput] = useState(apiKey)
  const [balInput, setBalInput] = useState(String(balance))
  const [confirmReset, setConfirmReset] = useState(false)

  const saveKey = () => {
    setApiKey(keyInput.trim())
  }

  const syncBalance = () => {
    const val = parseFloat(balInput)
    if (!isNaN(val) && val >= 0) {
      setBalance(val)
      setBalanceHistory(prev => {
        const today = new Date().toISOString().split('T')[0]
        const existing = prev.findIndex(h => h.date === today)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = { date: today, balance: val }
          return updated
        }
        return [...prev, { date: today, balance: val }]
      })
    }
  }

  const doReset = () => {
    resetAllChallengeData()
    window.location.reload()
  }

  return (
    <div style={{ padding: 12 }}>
      {/* API Key */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: CC.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Polygon.io API Key</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="password"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            placeholder="Enter API key..."
            style={{
              flex: 1, padding: '8px 12px', fontFamily: FONTS.mono, fontSize: 13,
              color: CC.textBright, background: CC.bg, border: `1px solid ${CC.border}`,
              borderRadius: 6,
            }}
          />
          <button onClick={saveKey} style={{
            fontFamily: FONTS.heading, fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
            padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
            background: CC.accent, color: CC.bg, border: 'none', textTransform: 'uppercase',
          }}>SAVE</button>
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: apiKey ? CC.profit : CC.textMuted, marginTop: 4 }}>
          {apiKey ? '● Connected' : '○ Not configured'}
        </div>
      </div>

      {/* Balance Sync */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontFamily: FONTS.heading, fontSize: 10, fontWeight: 600, letterSpacing: 1.5, color: CC.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Balance Sync</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="number"
            value={balInput}
            onChange={e => setBalInput(e.target.value)}
            style={{
              flex: 1, padding: '8px 12px', fontFamily: FONTS.mono, fontSize: 13,
              color: CC.textBright, background: CC.bg, border: `1px solid ${CC.border}`,
              borderRadius: 6,
            }}
          />
          <button onClick={syncBalance} style={{
            fontFamily: FONTS.heading, fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
            padding: '8px 16px', borderRadius: 6, cursor: 'pointer',
            background: `${CC.accent}15`, color: CC.accent, border: `1px solid ${CC.accent}40`, textTransform: 'uppercase',
          }}>SYNC</button>
        </div>
      </div>

      {/* Danger Zone */}
      <div style={{
        marginTop: 30, padding: 16, background: `${CC.loss}08`,
        border: `1px solid ${CC.loss}30`, borderRadius: 8,
      }}>
        <div style={{ fontFamily: FONTS.heading, fontSize: 12, fontWeight: 700, letterSpacing: 2, color: CC.loss, marginBottom: 8 }}>DANGER ZONE</div>
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} style={{
            fontFamily: FONTS.heading, fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
            padding: '10px 20px', borderRadius: 6, cursor: 'pointer', width: '100%',
            background: 'transparent', color: CC.loss, border: `1px solid ${CC.loss}40`, textTransform: 'uppercase',
          }}>RESET ALL DATA</button>
        ) : (
          <div>
            <div style={{ fontFamily: FONTS.body, fontSize: 12, color: CC.loss, marginBottom: 8 }}>
              This will permanently delete all challenge data. Are you sure?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={doReset} style={{
                flex: 1, fontFamily: FONTS.heading, fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
                padding: '10px 20px', borderRadius: 6, cursor: 'pointer',
                background: CC.loss, color: '#fff', border: 'none', textTransform: 'uppercase',
              }}>CONFIRM RESET</button>
              <button onClick={() => setConfirmReset(false)} style={{
                flex: 1, fontFamily: FONTS.heading, fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
                padding: '10px 20px', borderRadius: 6, cursor: 'pointer',
                background: 'transparent', color: CC.textMuted, border: `1px solid ${CC.border}`, textTransform: 'uppercase',
              }}>CANCEL</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChallengeApp({ onBack }) {
  const [activeTab, setActiveTab] = useState('command')
  const [showSettings, setShowSettings] = useState(false)
  const [pendingTrade, setPendingTrade] = useState(null)

  // Persistent state
  const [balance, setBalance] = useStorage('balance', CHALLENGE.startingCapital)
  const [trades, setTrades] = useStorage('trades', [])
  const [balanceHistory, setBalanceHistory] = useStorage('balance_history', [
    { date: CHALLENGE.startDate, balance: CHALLENGE.startingCapital },
  ])
  const [watchlist, setWatchlist] = useStorage('watchlist', [])
  const [debriefs, setDebriefs] = useStorage('debriefs', {})
  const envKey = typeof __POLYGON_API_KEY__ !== 'undefined' ? __POLYGON_API_KEY__ : ''
  const [apiKey, setApiKey] = useStorage('polygon_api_key', envKey)
  const [timeframeMode, setTimeframeMode] = useStorage('timeframe_mode', 'swing')

  const tier = getTier(balance)
  const tierDef = TIERS[tier]
  const openPositions = trades.filter(t => t.status === 'open')

  const handleOpenTrade = useCallback((idea) => {
    setPendingTrade(idea)
    setActiveTab('trades')
  }, [])

  const clearPendingTrade = useCallback(() => setPendingTrade(null), [])

  const renderTab = () => {
    if (showSettings) {
      return <SettingsPanel apiKey={apiKey} setApiKey={setApiKey} balance={balance} setBalance={setBalance} setBalanceHistory={setBalanceHistory} />
    }
    switch (activeTab) {
      case 'command': return <CommandTab balance={balance} trades={trades} balanceHistory={balanceHistory} openPositions={openPositions} />
      case 'grading': return <GradingTab watchlist={watchlist} apiKey={apiKey} />
      case 'alerts': return <AlertsTab watchlist={watchlist} />
      case 'watchlist': return <WatchlistTab watchlist={watchlist} setWatchlist={setWatchlist} apiKey={apiKey} timeframeMode={timeframeMode} setTimeframeMode={setTimeframeMode} />
      case 'ideas': return <IdeasTab watchlist={watchlist} apiKey={apiKey} balance={balance} timeframeMode={timeframeMode} onOpenTrade={handleOpenTrade} />
      case 'trades': return <TradesTab trades={trades} setTrades={setTrades} balance={balance} setBalance={setBalance} balanceHistory={balanceHistory} setBalanceHistory={setBalanceHistory} pendingTrade={pendingTrade} clearPendingTrade={clearPendingTrade} />
      case 'sizer': return <SizerTab balance={balance} />
      case 'risk': return <RiskTab balance={balance} trades={trades} />
      case 'debrief': return <DebriefTab trades={trades} debriefs={debriefs} setDebriefs={setDebriefs} balanceHistory={balanceHistory} />
      case 'playbook': return <PlaybookTab balance={balance} />
      default: return <CommandTab balance={balance} trades={trades} balanceHistory={balanceHistory} openPositions={openPositions} />
    }
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: CC.bg, color: CC.text, fontFamily: FONTS.body,
    }}>
      {/* Font loader */}
      <link rel="stylesheet" href={FONT_URL} />

      {/* Top Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', background: CC.surface, borderBottom: `1px solid ${CC.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onBack && (
            <button onClick={onBack} style={{
              fontFamily: FONTS.mono, fontSize: 16, color: CC.textMuted, background: 'none',
              border: 'none', cursor: 'pointer', padding: '0 4px',
            }}>←</button>
          )}
          <div>
            <span style={{ fontFamily: FONTS.heading, fontWeight: 700, fontSize: 14, letterSpacing: 2, color: CC.gold }}>$5K</span>
            <span style={{ fontFamily: FONTS.heading, fontWeight: 600, fontSize: 11, letterSpacing: 1, color: CC.textMuted, marginLeft: 6 }}>CHALLENGE</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: 12, fontWeight: 700, color: CC.accent }}>
            ${balance.toLocaleString()}
          </span>
          <span style={{
            fontFamily: FONTS.mono, fontSize: 9, fontWeight: 600, padding: '2px 6px',
            borderRadius: 3, color: tierDef.color, background: `${tierDef.color}15`,
            border: `1px solid ${tierDef.color}30`,
          }}>
            {tierDef.tag}
          </span>
          <button onClick={() => setShowSettings(!showSettings)} style={{
            fontFamily: FONTS.mono, fontSize: 14, color: showSettings ? CC.accent : CC.textMuted,
            background: 'none', border: 'none', cursor: 'pointer',
          }}>⚙</button>
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        paddingBottom: 56, WebkitOverflowScrolling: 'touch',
      }}>
        {renderTab()}
      </div>

      {/* Bottom Tab Bar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: CC.surface, borderTop: `1px solid ${CC.border}`,
        flexShrink: 0, overflowX: 'auto',
      }}>
        {TABS.map(tab => {
          const isActive = !showSettings && activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setShowSettings(false) }}
              style={{
                flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 1, padding: '8px 2px',
                background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              <span style={{
                fontSize: 14, color: isActive ? CC.accent : CC.textMuted,
                transition: 'color 0.2s',
              }}>{tab.icon}</span>
              <span style={{
                fontFamily: FONTS.heading, fontWeight: 700, fontSize: 7, letterSpacing: 1,
                color: isActive ? CC.accent : CC.textMuted, transition: 'color 0.2s',
              }}>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
