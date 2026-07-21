class PagedResponse<T> {
  const PagedResponse({
    required this.count,
    required this.next,
    required this.previous,
    required this.results,
  });

  final int count;
  final String? next;
  final String? previous;
  final List<T> results;

  factory PagedResponse.fromJson(Map<String, dynamic> json, T Function(Map<String, dynamic>) parser) {
    final rows = (json['results'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(parser)
        .toList();
    return PagedResponse<T>(
      count: json['count'] as int? ?? rows.length,
      next: json['next'] as String?,
      previous: json['previous'] as String?,
      results: rows,
    );
  }
}
