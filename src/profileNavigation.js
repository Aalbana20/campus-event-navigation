export const navigateToProfile = (navigate, profile = {}, currentUser = {}) => {
  const profileId = profile?.id ? String(profile.id) : ""
  const username = profile?.username ? String(profile.username) : ""
  const currentUserId = currentUser?.id ? String(currentUser.id) : ""
  const currentUsername = currentUser?.username ? String(currentUser.username) : ""

  if (!profileId && !username) return

  if (
    (profileId && currentUserId && profileId === currentUserId) ||
    (username && currentUsername && username === currentUsername)
  ) {
    navigate("/profile")
    return
  }

  navigate(`/profile/${username || profileId}`)
}
