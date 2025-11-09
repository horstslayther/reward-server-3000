export function requireRole(role) {
  return (req, res, next) => {
    const sessionUser = req.session?.user;
    if (!sessionUser) return res.status(401).json({ error: 'Unauthorized' });
    if (sessionUser.role !== role) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

export function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}
