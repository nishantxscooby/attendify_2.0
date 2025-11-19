import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

import '../services/firestore_service.dart';

class AuthProvider extends ChangeNotifier {
  AuthProvider({
    FirebaseAuth? auth,
    FirebaseFirestore? firestore,
    FirestoreService? firestoreService,
  })  : _auth = auth ?? FirebaseAuth.instance,
        _firestore = firestore ?? FirebaseFirestore.instance,
        _firestoreService = firestoreService ??
            FirestoreService(firestore: firestore ?? FirebaseFirestore.instance) {
    _user = _auth.currentUser;
    if (_user != null) {
      _listenToRole(_user!.uid);
    }
    _authSubscription = _auth.userChanges().listen(_handleUserChange);
  }

  final FirebaseAuth _auth;
  final FirebaseFirestore _firestore;
  final FirestoreService _firestoreService;

  static const Set<String> _validRoles = {
    'admin',
    'teacher',
    'student',
    'dept',
    'management',
    'policymaker',
  };

  StreamSubscription<User?>? _authSubscription;
  StreamSubscription<AppUser?>? _roleSubscription;

  User? _user;
  String? _role;
  bool loading = false;
  String? error;

  User? get user => _user;
  String? get role => _role;
  bool get isLoggedIn => _user != null;
  Stream<User?> get userChanges => _auth.userChanges();

  Future<bool> signIn(String email, String password) async {
    loading = true;
    error = null;
    notifyListeners();

    try {
      final credential = await _auth.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      _user = credential.user;
      if (_user != null) {
        await _loadRole(_user!.uid);
      }
      return true;
    } on FirebaseAuthException catch (e) {
      error = _readableAuthError(e);
      return false;
    } catch (e) {
      debugPrint('SIGN IN ERROR: $e');
      error = 'Unable to sign in. Please try again later.';
      return false;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<bool> login(String email, String password) => signIn(email, password);

  Future<void> signOut() async {
    loading = true;
    notifyListeners();
    try {
      await _auth.signOut();
      _user = null;
      _role = null;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> reload() async {
    final current = _auth.currentUser;
    if (current != null) {
      await current.reload();
      _handleUserChange(_auth.currentUser);
    }
  }

  Future<void> _loadRole(String uid) async {
    _listenToRole(uid);
    final snapshot = await _firestore.collection('users').doc(uid).get();
    if (!snapshot.exists) return;
    final data = snapshot.data();
    final role = data?['role'] as String?;
    _applyRole(role);
  }

  void _listenToRole(String uid) {
    _roleSubscription?.cancel();
    _roleSubscription = _firestoreService.watchUser(uid).listen(
      (appUser) {
        _applyRole(appUser?.role);
      },
      onError: (Object e, StackTrace stack) {
        debugPrint('ROLE STREAM ERROR: $e');
      },
    );
  }

  void _handleUserChange(User? user) {
    if (_user?.uid == user?.uid) {
      _user = user;
      return;
    }

    _user = user;
    if (user == null) {
      _roleSubscription?.cancel();
      _role = null;
    } else {
      _listenToRole(user.uid);
    }
    notifyListeners();
  }

  void _applyRole(String? newRole) {
    final sanitizedRole =
        newRole != null && _validRoles.contains(newRole) ? newRole : null;
    if (_role == sanitizedRole) return;
    _role = sanitizedRole;
    notifyListeners();
  }

  String _readableAuthError(FirebaseAuthException exception) {
    switch (exception.code) {
      case 'invalid-email':
        return 'The email address appears to be invalid.';
      case 'user-disabled':
        return 'This account has been disabled. Contact support for help.';
      case 'user-not-found':
      case 'wrong-password':
        return 'Incorrect email or password. Please try again.';
      case 'too-many-requests':
        return 'Too many attempts. Please wait and try again.';
      default:
        return 'Authentication failed (${exception.code}).';
    }
  }

  @override
  void dispose() {
    _authSubscription?.cancel();
    _roleSubscription?.cancel();
    super.dispose();
  }
}
