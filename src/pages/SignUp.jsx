import React, { useState } from "react"

function SignUp() {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [accountType, setAccountType] = useState("Student")
  const [schoolId, setSchoolId] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const handleSignUp = (e) => {
    e.preventDefault()

    if (!firstName || !lastName || !schoolId || !email || !password || !confirmPassword) {
      alert("Please fill in all fields.")
      return
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match.")
      return
    }

    alert(`Account created as ${accountType}!`)
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
          </div>

          <div className="signup-group">
            <input
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="signup-btn">
            Create Account
          </button>
        </form>

        <p className="signup-footer">
          Already have an account? <span>Sign In</span>
        </p>
      </div>
    </main>
  )
}

export default SignUp