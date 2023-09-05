const router = require('express').Router();
const auth = require('../../middleware/authenticate');
const ctrl = require('./controller');

router.post('/', ctrl.create);
router.post('/login',ctrl.login);
router.post('/logout', ctrl.logout);
router.post('/logout/all', auth, ctrl.logoutAll);
router.post('/token-health', auth, ctrl.getTokenStatus);

// router.post('/user/change-password', auth);
router.post('/status', auth, ctrl.setUserStatus);
router.post('/pk', auth, ctrl.setPublicKey);

router.get('/:id/status', auth, ctrl.getUserStatus);
router.get('/:id/pk', auth, ctrl.getPublicKey);


module.exports = router;