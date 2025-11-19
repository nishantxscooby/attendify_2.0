import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import 'login_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  static const String routeName = '/dashboard';

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Future<Map<String, dynamic>> _dashboardFuture;
  bool _demoMode = true;

  @override
  void initState() {
    super.initState();
    _dashboardFuture = _loadDashboard();
  }

  Future<Map<String, dynamic>> _loadDashboard() {
    final auth = context.read<AuthProvider>();
    _demoMode = auth.user == null;
    if (_demoMode) {
      return _demoData();
    }
    final uid = auth.user?.uid ?? '';
    return _fetchDashboard(uid);
  }

  Future<void> _refresh() async {
    final future = _loadDashboard();
    setState(() {
      _dashboardFuture = future;
    });
    try {
      await future;
    } catch (_) {
      // Let the refresh indicator complete even if the fetch fails.
    }
  }

  Future<Map<String, dynamic>> _demoData() async {
    return Future<Map<String, dynamic>>.value({
      'name': 'Test User',
      'today': {
        'status': 'Present',
        'checkIn': '09:12',
        'checkOut': '18:01',
      },
      'weeklyAttendance': const <int>[1, 1, 1, 0, 1],
      'recent': const <Map<String, String>>[
        {'date': 'Mon', 'in': '09:12', 'out': '18:01'},
        {'date': 'Tue', 'in': '09:09', 'out': '18:05'},
        {'date': 'Wed', 'in': '09:03', 'out': '18:02'},
      ],
    });
  }

  Future<Map<String, dynamic>> _fetchDashboard(String uid) async {
    // TODO: Integrate with real dashboard endpoint once available.
    return Future<Map<String, dynamic>>.value(<String, dynamic>{});
  }

  Future<void> _logout() async {
    if (!mounted) return;
    await context.read<AuthProvider>().signOut();
    if (!mounted) return;
    Navigator.of(context).pushReplacementNamed(LoginScreen.routeName);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          Consumer<AuthProvider>(
            builder: (context, auth, _) {
              final email = auth.user?.email;
              if (email == null) return const SizedBox.shrink();
              return Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Center(
                  child: Text(
                    email,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: _logout,
            tooltip: 'Sign out',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<Map<String, dynamic>>(
          future: _dashboardFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) {
              return const _LoadingState();
            }

            if (snapshot.hasError) {
              return _ErrorState(onRetry: _refresh);
            }

            final Map<String, dynamic>? data = snapshot.data;
            if (data == null || data.isEmpty) {
              return const _EmptyState();
            }

            final String? name = data['name'] as String?;
            final Map<String, dynamic>? today = data['today'] as Map<String, dynamic>?;
            final List<dynamic>? weeklyRaw = data['weeklyAttendance'] as List<dynamic>?;
            final List<int> weeklyAttendance = weeklyRaw == null
                ? const <int>[]
                : weeklyRaw.map((dynamic e) => e is num ? e.toInt() : 0).toList();
            final List<dynamic>? recentRaw = data['recent'] as List<dynamic>?;
            final List<Map<String, String>> recentEntries = recentRaw == null
                ? const <Map<String, String>>[]
                : recentRaw
                    .map((dynamic entry) => entry is Map<String, dynamic>
                        ? entry.map((key, value) => MapEntry(key, value?.toString() ?? ''))
                        : <String, String>{})
                    .toList();

            return ListView(
              padding: const EdgeInsets.all(16),
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                if (name != null && name.isNotEmpty)
                  Text(
                    'Welcome, $name',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                if (name != null && name.isNotEmpty) const SizedBox(height: 16),
                _TodayCard(today: today),
                const SizedBox(height: 16),
                _WeekCard(attendance: weeklyAttendance),
                const SizedBox(height: 16),
                _RecentList(entries: recentEntries),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _TodayCard extends StatelessWidget {
  const _TodayCard({required this.today});

  final Map<String, dynamic>? today;

  @override
  Widget build(BuildContext context) {
    final String status = (today?['status'] ?? '—').toString();
    final String checkIn = (today?['checkIn'] ?? '--:--').toString();
    final String checkOut = (today?['checkOut'] ?? '--:--').toString();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Today', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _TodayStat(label: 'Status', value: status),
                _TodayStat(label: 'Check in', value: checkIn),
                _TodayStat(label: 'Check out', value: checkOut),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _TodayStat extends StatelessWidget {
  const _TodayStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final TextTheme textTheme = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: textTheme.labelMedium),
        const SizedBox(height: 4),
        Text(value, style: textTheme.titleMedium),
      ],
    );
  }
}

class _WeekCard extends StatelessWidget {
  const _WeekCard({required this.attendance});

  final List<int> attendance;

  static const List<String> _labels = <String>['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('This Week', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            SizedBox(
              height: 120,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: List<Widget>.generate(_labels.length, (int index) {
                  final bool present = index < attendance.length ? attendance[index] > 0 : false;
                  final double barHeight = present ? 80 : 24;
                  return Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Container(
                          height: barHeight,
                          width: 20,
                          decoration: BoxDecoration(
                            borderRadius: const BorderRadius.all(Radius.circular(8)),
                            color: present
                                ? Theme.of(context).colorScheme.primary
                                : Theme.of(context).colorScheme.surfaceContainerHighest,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(_labels[index], style: Theme.of(context).textTheme.labelMedium),
                      ],
                    ),
                  );
                }),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RecentList extends StatelessWidget {
  const _RecentList({required this.entries});

  final List<Map<String, String>> entries;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Recent punches', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            if (entries.isEmpty)
              Text('No punches recorded yet.', style: Theme.of(context).textTheme.bodyMedium)
            else
              ...entries.map((Map<String, String> entry) {
                final String date = entry['date'] ?? '—';
                final String checkIn = entry['in'] ?? '--:--';
                final String checkOut = entry['out'] ?? '--:--';
                return ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text(date),
                  subtitle: Text('In: $checkIn · Out: $checkOut'),
                );
              }),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(32),
      children: [
        Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.calendar_today_outlined, size: 48, color: Theme.of(context).colorScheme.outline),
              const SizedBox(height: 16),
              Text('No attendance data yet', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Text(
                'Pull down to refresh once your account is linked to the dashboard.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.onRetry});

  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(32),
      children: [
        Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 48, color: Theme.of(context).colorScheme.error),
              const SizedBox(height: 16),
              Text('We ran into a problem', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Text(
                'Please try again. If the issue persists, contact your administrator.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () {
                  onRetry();
                },
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: const [
        SizedBox(height: 180),
        Center(child: CircularProgressIndicator()),
        SizedBox(height: 180),
      ],
    );
  }
}
