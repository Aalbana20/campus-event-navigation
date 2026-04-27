import React, { useEffect, useMemo, useRef, useState } from "react"
import { Camera, Eye, EyeOff, Pencil, Search, Sparkles, User, Building2, ChevronRight } from "./icons"
import { supabase } from "../../supabaseClient"
import {
  BIRTH_MONTHS,
  INTEREST_OPTIONS,
  ORGANIZATION_TYPES,
  US_SCHOOLS,
  formatPhoneNumber,
  getBirthYearOptions,
  getPasswordChecks,
  isValidEmail,
  isValidUsername,
  normalizeUsername,
  sanitizePhoneNumber,
} from "../../signupData"
import {
  Banner,
  Chip,
  FloatingInput,
  GhostButton,
  LightButton,
  PrimaryButton,
  StatusIcon,
} from "./OnboardingPrimitives"

/* ---------------- Entry ---------------- */
export function StepEntry({ onCreate, onLogin }) {
  return (
    <>
      <div className="onb-center">
        <div className="onb-logo-mark">CE</div>
        <h1 className="onb-title">Find your people. Find your night.</h1>
        <p className="onb-tagline">Discover events on and off campus, RSVP with friends, and don't miss the moment.</p>
      </div>
      <div className="onb-actions">
        <PrimaryButton onClick={onCreate}>Create Account</PrimaryButton>
        <GhostButton onClick={onLogin}>I already have one</GhostButton>
      </div>
    </>
  )
}

/* ---------------- Step 1: Account Type ---------------- */
export function StepAccountType({ data, update, goNext }) {
  const select = (type) => {
    update({ accountType: type })
    setTimeout(goNext, 220)
  }
  return (
    <>
      <h1 className="onb-title">How will you use the app?</h1>
      <p className="onb-subtitle">You can run an org account separately later.</p>
      <div className="onb-card-stack">
        <button
          type="button"
          className={`onb-card ${data.accountType === "individual" ? "is-selected" : ""}`}
          onClick={() => select("individual")}
        >
          <span className="onb-card-icon"><User size={22} /></span>
          <span className="onb-card-body">
            <p className="onb-card-title">Individual</p>
            <p className="onb-card-desc">Discover events, RSVP, message friends</p>
          </span>
          <ChevronRight size={20} className="onb-card-chev" />
        </button>
        <button
          type="button"
          className={`onb-card ${data.accountType === "organization" ? "is-selected" : ""}`}
          onClick={() => select("organization")}
        >
          <span className="onb-card-icon"><Building2 size={22} /></span>
          <span className="onb-card-body">
            <p className="onb-card-title">Organization</p>
            <p className="onb-card-desc">Host events, build a following</p>
          </span>
          <ChevronRight size={20} className="onb-card-chev" />
        </button>
      </div>
    </>
  )
}

/* ---------------- Step 2: College Question ---------------- */
export function StepCollege({ data, update, goNext }) {
  const select = (val) => {
    update({ inCollege: val })
    setTimeout(goNext, 200)
  }
  return (
    <>
      <h1 className="onb-title">Are you in college?</h1>
      <p className="onb-subtitle">If so, we'll verify your school — it unlocks campus events.</p>
      <div className="onb-binary">
        <button
          type="button"
          className={`onb-binary-tile ${data.inCollege === true ? "is-selected" : ""}`}
          onClick={() => select(true)}
        >
          Yes
        </button>
        <button
          type="button"
          className={`onb-binary-tile ${data.inCollege === false ? "is-selected" : ""}`}
          onClick={() => select(false)}
        >
          No
        </button>
      </div>
    </>
  )
}

/* ---------------- Step 3: School + .edu verification ---------------- */
export function StepSchool({ data, update, goNext }) {
  const [query, setQuery] = useState(data.schoolLabel || "")
  const [showResults, setShowResults] = useState(false)
  const [phase, setPhase] = useState("entering") // entering | sending | sent
  const [error, setError] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return US_SCHOOLS.slice(0, 7)
    return US_SCHOOLS.filter((s) =>
      `${s.label} ${(s.domains || []).join(" ")}`.toLowerCase().includes(q)
    ).slice(0, 8)
  }, [query])

  const selectedSchool = US_SCHOOLS.find((s) => s.id === data.schoolId)
  const expectedDomain = selectedSchool?.domains?.[0]

  const emailMatches =
    !!expectedDomain &&
    isValidEmail(data.eduEmail || "") &&
    (data.eduEmail || "").trim().toLowerCase().endsWith(`@${expectedDomain}`)

  const handleVerify = () => {
    if (!emailMatches) {
      setError(`Use a ${expectedDomain} email to verify your school.`)
      return
    }
    setError("")
    setPhase("sending")
    // Verification placeholder. Real flow would call supabase.auth.signInWithOtp({ email })
    // here and gate progression on the user clicking the magic link, then verifying server-side.
    setTimeout(() => setPhase("sent"), 1100)
  }

  if (phase === "sent") {
    const masked = (data.eduEmail || "").replace(/^(.).+(@.+)$/, "$1***$2")
    return (
      <>
        <div style={{ paddingTop: 16 }}>
          <div className="onb-status-ring success" style={{ width: 56, height: 56, marginBottom: 24 }}>
            <span style={{ fontSize: 24, fontWeight: 700 }}>✓</span>
          </div>
          <h1 className="onb-title">Check your inbox</h1>
          <p className="onb-subtitle">
            We sent a verification link to <strong style={{ color: "var(--onb-text)" }}>{masked}</strong>. Open it on this device, then come back and continue.
          </p>
        </div>
        <div className="onb-spacer" />
        <div className="onb-actions">
          <PrimaryButton onClick={goNext}>Continue</PrimaryButton>
          <GhostButton onClick={() => setPhase("entering")}>Use a different email</GhostButton>
        </div>
      </>
    )
  }

  return (
    <>
      <h1 className="onb-title">What school?</h1>
      <p className="onb-subtitle">We'll send a verification link to your .edu address.</p>

      <div className="onb-field">
        <div className="onb-input-wrap">
          <span style={{ paddingLeft: 16, color: "var(--onb-text-secondary)", display: "flex" }}>
            <Search size={18} />
          </span>
          <input
            className="onb-input"
            style={{ paddingTop: 8 }}
            placeholder="Search your school"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShowResults(true)
              if (data.schoolId) update({ schoolId: "", schoolLabel: "" })
            }}
            onFocus={() => setShowResults(true)}
          />
        </div>
        {showResults && filtered.length > 0 && !data.schoolId ? (
          <div className="onb-search-results">
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                className="onb-search-row"
                onClick={() => {
                  update({ schoolId: s.id, schoolLabel: s.label })
                  setQuery(s.label)
                  setShowResults(false)
                }}
              >
                <strong>{s.label}</strong>
                <span>{s.domains?.[0]}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <FloatingInput
        label="School email"
        type="email"
        autoComplete="email"
        value={data.eduEmail || ""}
        onChange={(e) => update({ eduEmail: e.target.value })}
        helper={expectedDomain ? `Must end with @${expectedDomain}` : "Pick a school first"}
      />

      {error ? <Banner>{error}</Banner> : null}

      <div className="onb-spacer" />
      <div className="onb-actions">
        <PrimaryButton
          onClick={handleVerify}
          disabled={!data.schoolId || !data.eduEmail || phase === "sending"}
        >
          {phase === "sending" ? "Sending..." : "Verify"}
        </PrimaryButton>
      </div>
    </>
  )
}

/* ---------------- Step 4: Username ---------------- */
export function StepUsername({ data, update, goNext }) {
  const [status, setStatus] = useState("idle") // idle | checking | available | taken | invalid
  const username = data.username || ""
  const normalized = normalizeUsername(username)
  const valid = isValidUsername(normalized)

  useEffect(() => {
    if (!normalized) {
      setStatus("idle")
      return
    }
    if (!valid) {
      setStatus("invalid")
      return
    }
    let active = true
    const t = window.setTimeout(async () => {
      setStatus("checking")
      const { data: row, error } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", normalized)
        .maybeSingle()
      if (!active) return
      if (error && error.code !== "PGRST116") {
        setStatus("idle")
        return
      }
      setStatus(row ? "taken" : "available")
    }, 350)
    return () => {
      active = false
      window.clearTimeout(t)
    }
  }, [normalized, valid])

  const helper =
    status === "invalid"
      ? "3–20 characters. Letters, numbers, dots, underscores."
      : status === "taken"
      ? "That one's gone. Try another."
      : status === "available"
      ? "Looks good."
      : "You can change this later."
  const helperState =
    status === "taken" || status === "invalid"
      ? "error"
      : status === "available"
      ? "success"
      : null

  return (
    <>
      <h1 className="onb-title">Create a username</h1>
      <p className="onb-subtitle">Use our suggestion or add your own. You can change this later.</p>

      <FloatingInput
        label="Username"
        value={username}
        onChange={(e) => update({ username: normalizeUsername(e.target.value) })}
        autoComplete="username"
        autoFocus
        state={status === "available" ? "success" : status === "taken" || status === "invalid" ? "error" : null}
        rightSlot={<StatusIcon status={status} />}
        helper={helper}
        helperState={helperState}
      />

      <div className="onb-spacer" />
      <div className="onb-actions">
        <PrimaryButton onClick={goNext} disabled={status !== "available"}>Next</PrimaryButton>
      </div>
    </>
  )
}

/* ---------------- Step 5: Birth month + year ---------------- */
export function StepBirth({ data, update, goNext }) {
  const years = useMemo(() => getBirthYearOptions(), [])
  const monthIdx = data.birthMonth ? Number(data.birthMonth) - 1 : 4 // default May
  const yearIdx = data.birthYear ? years.indexOf(String(data.birthYear)) : 5

  const monthRef = useRef(null)
  const yearRef = useRef(null)
  const ITEM_H = 44

  // Sync scroll on first render to current selection.
  useEffect(() => {
    if (monthRef.current) monthRef.current.scrollTop = monthIdx * ITEM_H
    if (yearRef.current) yearRef.current.scrollTop = yearIdx * ITEM_H
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onMonthScroll = (e) => {
    const idx = Math.round(e.currentTarget.scrollTop / ITEM_H)
    const safe = Math.max(0, Math.min(BIRTH_MONTHS.length - 1, idx))
    if (String(safe + 1) !== String(data.birthMonth)) {
      update({ birthMonth: String(safe + 1) })
    }
  }
  const onYearScroll = (e) => {
    const idx = Math.round(e.currentTarget.scrollTop / ITEM_H)
    const safe = Math.max(0, Math.min(years.length - 1, idx))
    if (years[safe] !== String(data.birthYear)) {
      update({ birthYear: years[safe] })
    }
  }

  const monthLabel = BIRTH_MONTHS[monthIdx]?.label || "May"
  const yearLabel = years[yearIdx] || ""

  return (
    <>
      <h1 className="onb-title">When were you born?</h1>
      <p className="onb-subtitle">We use this to recommend age-appropriate events. Hidden from your profile.</p>

      <div className="onb-wheel-display">
        <div className="onb-wheel-display-label">Birth date</div>
        <div className="onb-wheel-display-value">{monthLabel} {yearLabel}</div>
      </div>

      <div className="onb-wheel">
        <div className="onb-wheel-highlight" />
        <div ref={monthRef} className="onb-wheel-col" onScroll={onMonthScroll}>
          {BIRTH_MONTHS.map((m, i) => (
            <div key={m.value} className={`onb-wheel-item ${i === monthIdx ? "is-active" : ""}`}>
              {m.label}
            </div>
          ))}
        </div>
        <div ref={yearRef} className="onb-wheel-col" onScroll={onYearScroll}>
          {years.map((y, i) => (
            <div key={y} className={`onb-wheel-item ${i === yearIdx ? "is-active" : ""}`}>
              {y}
            </div>
          ))}
        </div>
      </div>

      <div className="onb-spacer" />
      <div className="onb-actions">
        <PrimaryButton onClick={goNext} disabled={!data.birthMonth || !data.birthYear}>Next</PrimaryButton>
      </div>
    </>
  )
}

/* ---------------- Step 6: Phone Number ---------------- */
export function StepPhone({ data, update, goNext }) {
  const digits = sanitizePhoneNumber(data.phone || "").replace(/\D/g, "")
  const ready = digits.length === 10
  return (
    <>
      <h1 className="onb-title">Your phone number</h1>
      <p className="onb-subtitle">We'll text a code to confirm it's you.</p>

      <div className="onb-phone-row">
        <button type="button" className="onb-cc-btn">🇺🇸 +1</button>
        <FloatingInput
          label="Phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={data.phone || ""}
          onChange={(e) => update({ phone: formatPhoneNumber(e.target.value) })}
        />
      </div>

      <div className="onb-spacer" />
      <div className="onb-actions">
        <PrimaryButton onClick={goNext} disabled={!ready}>Send code</PrimaryButton>
      </div>
    </>
  )
}

/* ---------------- Step 6b: OTP ---------------- */
export function StepOtp({ data, update, goNext, goBack }) {
  const [code, setCode] = useState(["", "", "", "", "", ""])
  const [error, setError] = useState(false)
  const [cooldown, setCooldown] = useState(60)
  const refs = useRef([])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const setDigit = (i, v) => {
    const d = v.replace(/\D/g, "").slice(0, 1)
    setCode((curr) => {
      const next = [...curr]
      next[i] = d
      // auto-advance verification on completion
      if (next.every((x) => x !== "") && d) {
        // OTP placeholder: any 6-digit code passes. Wire to supabase.auth.verifyOtp here.
        update({ phoneVerified: true })
        setTimeout(goNext, 250)
      }
      return next
    })
    if (d && refs.current[i + 1]) refs.current[i + 1].focus()
  }

  const onPaste = (e) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    if (!text) return
    e.preventDefault()
    const next = ["", "", "", "", "", ""]
    for (let i = 0; i < text.length; i++) next[i] = text[i]
    setCode(next)
    if (text.length === 6) {
      update({ phoneVerified: true })
      setTimeout(goNext, 250)
    } else {
      refs.current[text.length]?.focus()
    }
  }

  const onKey = (i, e) => {
    if (e.key === "Backspace" && !code[i] && refs.current[i - 1]) {
      refs.current[i - 1].focus()
    }
  }

  return (
    <>
      <h1 className="onb-title">Enter the code</h1>
      <p className="onb-subtitle">
        Sent to {data.phone || "your phone"} ·{" "}
        <span className="onb-link" onClick={goBack}>Change</span>
      </p>

      <div className={`onb-otp-row ${error ? "has-error" : ""}`} onPaste={onPaste}>
        {code.map((c, i) => (
          <input
            key={i}
            ref={(el) => (refs.current[i] = el)}
            className="onb-otp-cell"
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={c}
            onChange={(e) => {
              setError(false)
              setDigit(i, e.target.value)
            }}
            onKeyDown={(e) => onKey(i, e)}
            autoFocus={i === 0}
          />
        ))}
      </div>

      <div className="onb-spacer" />
      <div className="onb-actions">
        <GhostButton onClick={() => setCooldown(60)} disabled={cooldown > 0}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </GhostButton>
      </div>
    </>
  )
}

/* ---------------- Step 7: Password ---------------- */
function strengthLevel(pw) {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score += 1
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1
  if (/\d/.test(pw)) score += 1
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) score += 1
  return Math.min(score, 4)
}
const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"]

export function StepPassword({ data, update, goNext }) {
  const [show, setShow] = useState(false)
  const pw = data.password || ""
  const cf = data.confirmPassword || ""
  const checks = getPasswordChecks(pw)
  const lvl = strengthLevel(pw)
  const matches = pw && pw === cf
  const ready = checks.length && matches
  return (
    <>
      <h1 className="onb-title">Create a password</h1>
      <p className="onb-subtitle">8+ characters. Mix it up — letters, numbers, symbols.</p>

      <FloatingInput
        label="Password"
        type={show ? "text" : "password"}
        autoComplete="new-password"
        value={pw}
        onChange={(e) => update({ password: e.target.value })}
        rightSlot={
          <button
            type="button"
            className="onb-iconbtn"
            style={{ width: 32, height: 32 }}
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        }
      />

      <div className="onb-strength" aria-hidden>
        {[1, 2, 3, 4].map((seg) => (
          <div key={seg} className={`onb-strength-seg ${seg <= lvl ? `lvl-${lvl}` : ""}`} />
        ))}
      </div>
      <div className="onb-strength-label" style={{ marginBottom: 16 }}>
        {pw ? `${STRENGTH_LABELS[lvl]} password` : "Type to see strength"}
      </div>

      <FloatingInput
        label="Confirm password"
        type={show ? "text" : "password"}
        autoComplete="new-password"
        value={cf}
        onChange={(e) => update({ confirmPassword: e.target.value })}
        rightSlot={matches ? <StatusIcon status="success" /> : null}
        helper={cf && !matches ? "Passwords don't match." : null}
        helperState={cf && !matches ? "error" : null}
      />

      <div className="onb-spacer" />
      <div className="onb-actions">
        <PrimaryButton onClick={goNext} disabled={!ready}>Next</PrimaryButton>
      </div>
    </>
  )
}

/* ---------------- Step 8: Terms ---------------- */
export function StepTerms({ goNext, goBack }) {
  return (
    <>
      <div className="onb-center">
        <div className="onb-logo-mark" style={{ background: "var(--onb-bg-elevated)", marginBottom: 24 }}>
          <Sparkles size={28} />
        </div>
        <h1 className="onb-title">One last thing</h1>
        <p className="onb-subtitle">
          By continuing, you agree to our{" "}
          <span className="onb-link">Terms of Service</span> and acknowledge our{" "}
          <span className="onb-link">Privacy Policy</span>.
        </p>
      </div>
      <div className="onb-actions">
        <PrimaryButton onClick={goNext}>Agree &amp; continue</PrimaryButton>
        <GhostButton onClick={goBack}>Cancel</GhostButton>
      </div>
    </>
  )
}

/* ---------------- Step 9: Profile picture ---------------- */
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(new Error("Could not read image."))
    r.readAsDataURL(file)
  })
}

export function StepAvatar({ data, update, goNext, isOrg = false }) {
  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await readFileAsDataUrl(file)
    update({ avatarFile: file, avatarPreview: url })
  }
  const preview = data.avatarPreview
  return (
    <>
      <h1 className="onb-title">{isOrg ? "Add your logo" : "Add a profile photo"}</h1>
      <p className="onb-subtitle">{isOrg ? "Optional — but it builds trust." : "Helps friends recognize you. You can skip this."}</p>

      <div className="onb-avatar-area">
        <label className={`onb-avatar-circle ${preview ? "has-image" : ""} ${isOrg ? "is-square" : ""}`}>
          {preview ? <img src={preview} alt="" /> : <Camera size={32} />}
          {preview ? <span className="onb-avatar-edit"><Pencil size={16} /></span> : null}
          <input className="onb-hidden-file" type="file" accept="image/*" onChange={onFile} />
        </label>
      </div>

      <div className="onb-spacer" />
      <div className="onb-actions">
        <PrimaryButton onClick={goNext} disabled={!preview}>Continue</PrimaryButton>
        <GhostButton onClick={goNext}>Skip for now</GhostButton>
      </div>
    </>
  )
}

/* ---------------- Step 10: Interests (chips + describe) ---------------- */
export function StepInterests({ data, update, goNext }) {
  const [mode, setMode] = useState("tags") // "tags" | "describe"
  const interests = data.interests || []
  const description = data.interestDescription || ""

  const toggle = (val) => {
    const next = interests.includes(val) ? interests.filter((x) => x !== val) : [...interests, val]
    update({ interests: next })
  }

  const ready =
    mode === "tags" ? interests.length >= 3 : description.trim().length >= 20

  return (
    <>
      <h1 className="onb-title">What are you into?</h1>
      <p className="onb-subtitle">Pick a few, or describe your vibe. We'll handle the rest.</p>

      <div className="onb-segmented">
        <button className={mode === "tags" ? "is-active" : ""} onClick={() => setMode("tags")}>Pick tags</button>
        <button className={mode === "describe" ? "is-active" : ""} onClick={() => setMode("describe")}>Describe it</button>
      </div>

      {mode === "tags" ? (
        <>
          <div className="onb-chip-grid">
            {INTEREST_OPTIONS.map((tag) => (
              <Chip key={tag} active={interests.includes(tag)} onClick={() => toggle(tag)}>
                {interests.includes(tag) ? null : "+ "}{tag}
              </Chip>
            ))}
          </div>
          <div className={`onb-chip-counter ${interests.length >= 3 ? "is-met" : ""}`}>
            {interests.length} of 3 minimum selected
          </div>
        </>
      ) : (
        <>
          <div className="onb-textarea-wrap">
            <textarea
              className="onb-textarea"
              placeholder={"I'm into late-night dive bars, ambient music, small art galleries, and anything outdoors."}
              value={description}
              onChange={(e) => update({ interestDescription: e.target.value })}
              rows={5}
            />
            <span className="onb-textarea-hint"><Sparkles size={16} /></span>
          </div>
          <small className="onb-helper">We'll turn this into interests automatically.</small>
        </>
      )}

      <div className="onb-spacer" />
      <div className="onb-actions">
        <PrimaryButton onClick={goNext} disabled={!ready}>Finish</PrimaryButton>
      </div>
    </>
  )
}

/* ---------------- Step 11: Name (after Interests) ---------------- */
export function StepName({ data, update, onFinish }) {
  const first = data.firstName || ""
  const last = data.lastName || ""
  const ready = first.trim().length > 0
  return (
    <>
      <h1 className="onb-title">Your name</h1>
      <p className="onb-subtitle">Add your name so people know who they're connecting with.</p>

      <FloatingInput
        label="First name"
        value={first}
        onChange={(e) => update({ firstName: e.target.value })}
        autoComplete="given-name"
        autoFocus
      />
      <FloatingInput
        label="Last name (optional)"
        value={last}
        onChange={(e) => update({ lastName: e.target.value })}
        autoComplete="family-name"
      />

      <div className="onb-spacer" />
      <div className="onb-actions">
        <PrimaryButton onClick={() => onFinish("edit")} disabled={!ready}>Edit profile</PrimaryButton>
        <GhostButton onClick={() => onFinish("home")} disabled={!ready}>Next</GhostButton>
      </div>
    </>
  )
}

/* ---------------- Org variants ---------------- */
export function StepOrgName({ data, update, goNext }) {
  const value = data.orgName || ""
  return (
    <>
      <h1 className="onb-title">What's your org called?</h1>
      <p className="onb-subtitle">This is how people will find and follow you.</p>
      <FloatingInput
        label="Organization name"
        value={value}
        onChange={(e) => update({ orgName: e.target.value })}
        autoFocus
      />
      <div className="onb-spacer" />
      <div className="onb-actions">
        <PrimaryButton onClick={goNext} disabled={value.trim().length < 2}>Next</PrimaryButton>
      </div>
    </>
  )
}

export function StepOrgType({ data, update, goNext }) {
  const value = data.orgType || ""
  return (
    <>
      <h1 className="onb-title">What kind of org?</h1>
      <p className="onb-subtitle">Pick the closest fit.</p>
      <div className="onb-chip-grid">
        {ORGANIZATION_TYPES.map((t) => (
          <Chip key={t} active={value === t} onClick={() => update({ orgType: t })}>{t}</Chip>
        ))}
      </div>
      <div className="onb-spacer" />
      <div className="onb-actions">
        <PrimaryButton onClick={goNext} disabled={!value}>Next</PrimaryButton>
      </div>
    </>
  )
}

export function StepOrgVerify({ data, update, goNext }) {
  const [phase, setPhase] = useState("entering")
  const email = data.orgEmail || ""
  const ready = isValidEmail(email)
  const handleVerify = () => {
    setPhase("sending")
    setTimeout(() => setPhase("sent"), 1100)
  }
  if (phase === "sent") {
    return (
      <>
        <div style={{ paddingTop: 16 }}>
          <div className="onb-status-ring success" style={{ width: 56, height: 56, marginBottom: 24 }}>
            <span style={{ fontSize: 24, fontWeight: 700 }}>✓</span>
          </div>
          <h1 className="onb-title">Check your inbox</h1>
          <p className="onb-subtitle">
            We sent a verification link to <strong style={{ color: "var(--onb-text)" }}>{email}</strong>. Open it to confirm your org.
          </p>
        </div>
        <div className="onb-spacer" />
        <div className="onb-actions">
          <PrimaryButton onClick={goNext}>Continue</PrimaryButton>
          <GhostButton onClick={() => setPhase("entering")}>Use a different email</GhostButton>
        </div>
      </>
    )
  }
  return (
    <>
      <h1 className="onb-title">Verify your org</h1>
      <p className="onb-subtitle">Use a work or school email tied to this organization.</p>

      <FloatingInput
        label="Organization email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => update({ orgEmail: e.target.value })}
        autoFocus
      />

      <p style={{ fontSize: 13, color: "var(--onb-text-secondary)", marginTop: 8 }}>
        Don't have a work email?{" "}
        <span className="onb-link" onClick={goNext}>Submit for manual review →</span>
      </p>

      <div className="onb-spacer" />
      <div className="onb-actions">
        <PrimaryButton onClick={handleVerify} disabled={!ready || phase === "sending"}>
          {phase === "sending" ? "Sending..." : "Verify"}
        </PrimaryButton>
      </div>
    </>
  )
}

const ORG_CATEGORIES = [
  "Music",
  "Sports",
  "Networking",
  "Parties",
  "Workshops",
  "Greek Life",
  "Career",
  "Food",
  "Tech",
  "Wellness",
  "Arts",
  "Religious",
]

export function StepOrgCategories({ data, update, goNext }) {
  const value = data.orgCategories || []
  const toggle = (t) => {
    const next = value.includes(t) ? value.filter((x) => x !== t) : [...value, t]
    update({ orgCategories: next })
  }
  return (
    <>
      <h1 className="onb-title">What will you host?</h1>
      <p className="onb-subtitle">Pick a few categories to help people find your events.</p>
      <div className="onb-chip-grid">
        {ORG_CATEGORIES.map((t) => (
          <Chip key={t} active={value.includes(t)} onClick={() => toggle(t)}>
            {value.includes(t) ? null : "+ "}{t}
          </Chip>
        ))}
      </div>
      <div className={`onb-chip-counter ${value.length >= 1 ? "is-met" : ""}`}>
        {value.length} selected · pick at least 1
      </div>
      <div className="onb-spacer" />
      <div className="onb-actions">
        <PrimaryButton onClick={goNext} disabled={value.length < 1}>Finish</PrimaryButton>
      </div>
    </>
  )
}

/* ---------------- Final submit (loading + result) ---------------- */
export function StepSubmitting({ error, onRetry, onDone }) {
  return (
    <div className="onb-center">
      {error ? (
        <>
          <h1 className="onb-title">Something went wrong</h1>
          <p className="onb-subtitle">{error}</p>
          <div style={{ width: "100%", maxWidth: 320 }}>
            <PrimaryButton onClick={onRetry}>Try again</PrimaryButton>
          </div>
        </>
      ) : (
        <>
          <span className="onb-status-ring checking" style={{ width: 48, height: 48, marginBottom: 24 }} />
          <h1 className="onb-title">Setting things up…</h1>
          <p className="onb-subtitle">Just a moment.</p>
        </>
      )}
    </div>
  )
}

export function StepDone({ onDone }) {
  return (
    <>
      <div className="onb-center">
        <div className="onb-status-ring success" style={{ width: 64, height: 64, marginBottom: 24 }}>
          <span style={{ fontSize: 28, fontWeight: 700 }}>✓</span>
        </div>
        <h1 className="onb-title">You're in</h1>
        <p className="onb-subtitle">Account created. Sign in to start exploring.</p>
      </div>
      <div className="onb-actions">
        <PrimaryButton onClick={onDone}>Go to login</PrimaryButton>
      </div>
    </>
  )
}
