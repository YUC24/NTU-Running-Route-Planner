let isWriting = false;

function writeLock(req, res, next) {
  if (isWriting) {
    return res.status(503).json({ error: '伺服器忙碌中，請稍後再試' });
  }
  isWriting = true;
  res.on('finish', () => { isWriting = false; });
  next();
}

module.exports = writeLock;