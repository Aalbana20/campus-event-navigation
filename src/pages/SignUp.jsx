import React, { useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"

const passwordRules = [
  {
    id: "minLength",
    label: "At least 8 characters",
    test: (value) => value.length >= 8,
  },
  {
    id: "upper",
    label: "One uppercase letter",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    id: "lower",
    label: "One lowercase letter",
    test: (value) => /[a-z]/.test(value),
  },
  {
    id: "number",
    label: "One number",
    test: (value) => /\d/.test(value),
  },
  {
    id: "symbol",
    label: "One symbol",
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
]

function SignUp() {
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [accountType, setAccountType] = useState("Student")
  const [schoolId, setSchoolId] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const passwordChecks = useMemo(
    () =>
      passwordRules.map((rule) => ({
        ...rule,
        passed: rule.test(password),
      })),
    [password]
  )

  const passedRuleCount = passwordChecks.filter((rule) => rule.passed).length
  const isStrongPassword = passedRuleCount === passwordRules.length
  const passwordStrengthLabel =
    passedRuleCount <= 2 ? "Weak" : passedRuleCount <= 4 ? "Medium" : "Strong"

  const handleSignUp = async (e) => {
    e.preventDefault()

    if (!firstName || !lastName || !schoolId || !email || !password || !confirmPassword) {
      alert("Please fill in all fields.")
      return
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match.")
      return
    }

    if (!isStrongPassword) {
      alert("Please choose a stronger password before continuing.")
      return
    }

    try {
      setIsSubmitting(true)
      const username = `${firstName.trim()} ${lastName.trim()}`
      const response = await fetch("http://localhost:5000/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          username,
          password,
          schoolId: schoolId.trim(),
          accountType,
        }),
      })

      const data = await response.json()

      if (!response.ok || data.error) {
        alert(data.error || "Could not create account.")
        return
      }

      alert(`Account created as ${accountType}!`)
      setFirstName("")
      setLastName("")
      setSchoolId("")
      setEmail("")
      setPassword("")
      setConfirmPassword("")
      navigate("/auth/login")
    } catch {
      alert("Unable to reach the server. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="signup-page">
      <div className="signup-card">
        <h1>Create Your Account</h1>

        <p className="signup-subtext">
          Sign up to discover, create, and share campus events.
        </p>

        <form className="signup-form" onSubmit={handleSignUp}>
          <div className="signup-row">
            <input
              type="text"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />

            <input
              type="text"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>

          <div className="signup-group">
            <label>Account Type</label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
            >
              <option>Student</option>
              <option>Administration</option>
            </select>
          </div>

          <div className="signup-group">
            <label>
              {accountType === "Student" ? "Student ID" : "Administration ID"}
            </label>
            <input
              type="text"
              placeholder={
                accountType === "Student"
                  ? "Enter your Student ID"
                  : "Enter your Administration ID"
              }
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
            />
          </div>

          <div className="signup-group">
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="signup-group">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="password-strength-wrap">
              <p className={`password-strength-label strength-${passwordStrengthLabel.toLowerCase()}`}>
                Password Strength: {passwordStrengthLabel}
              </p>
              <div className="password-rule-list">
                {passwordChecks.map((rule) => (
                  <p
                    key={rule.id}
                    className={`password-rule ${rule.passed ? "passed" : "pending"}`}
                  >
                    {rule.passed ? "✓" : "•"} {rule.label}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div className="signup-group">
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="signup-btn"
            disabled={isSubmitting || !isStrongPassword}
          >
            {isSubmitting ? "Creating..." : "Create Account"}
          </button>
        </form>

        <p className="signup-footer">
          Already have an account? <Link to="/auth/login">Sign In</Link>
        </p>
      </div>
    </main>
  )
}

export default SignUp
