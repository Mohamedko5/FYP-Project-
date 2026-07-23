import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart' as intl;
import 'package:bayad_customer_app/l10n/app_localizations.dart';

import '../../../core/theme/app_colors.dart';
import '../../../shared/data/mobile_providers.dart';
import '../../../shared/data/mobile_repository.dart';
import '../../../shared/widgets/app_scaffold.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../domain/chat_models.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _controller = TextEditingController();
  PlatformFile? _attachment;
  bool _isSending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _markRead());
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String _clientMessageId() => 'mobile-${DateTime.now().microsecondsSinceEpoch}-${identityHashCode(this)}';

  Future<void> _markRead() async {
    try {
      await ref.read(mobileRepositoryProvider).markChatRead();
      ref.invalidate(chatUnreadCountProvider);
    } catch (_) {
      // Reading status is retried on the next refresh.
    }
  }

  Future<void> _refresh() async {
    ref.invalidate(chatMessagesProvider);
    await ref.read(chatMessagesProvider.future);
    await _markRead();
  }

  Future<void> _pickAttachment() async {
    final l10n = AppLocalizations.of(context);
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
      withData: false,
    );
    if (result == null || result.files.isEmpty) return;
    final file = result.files.first;
    final extension = (file.extension ?? '').toLowerCase();
    if (!{'jpg', 'jpeg', 'png', 'webp', 'pdf'}.contains(extension) || file.path == null) {
      setState(() => _error = l10n.unsupportedFile);
      return;
    }
    setState(() {
      _attachment = file;
      _error = null;
    });
  }

  Future<void> _send() async {
    final body = _controller.text.trim();
    final attachment = _attachment;
    if (_isSending || (body.isEmpty && attachment == null)) return;
    setState(() {
      _isSending = true;
      _error = null;
    });
    try {
      final repository = ref.read(mobileRepositoryProvider);
      if (attachment != null && attachment.path != null) {
        await repository.sendChatAttachment(path: attachment.path!, filename: attachment.name, body: body, clientMessageId: _clientMessageId());
      } else {
        await repository.sendChatText(body: body, clientMessageId: _clientMessageId());
      }
      _controller.clear();
      setState(() => _attachment = null);
      await _refresh();
    } catch (_) {
      setState(() => _error = AppLocalizations.of(context).failedToSend);
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  Future<void> _shareCard() async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      builder: (context) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.shareCustomerCardTitle, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            Text(l10n.shareCardMessage),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(context, false), child: Text(MaterialLocalizations.of(context).cancelButtonLabel))),
                const SizedBox(width: 10),
                Expanded(child: FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(l10n.shareCard))),
              ],
            ),
          ],
        ),
      ),
    );
    if (confirmed != true) return;
    setState(() => _isSending = true);
    try {
      await ref.read(mobileRepositoryProvider).shareCustomerCard(clientMessageId: _clientMessageId());
      await _refresh();
    } catch (_) {
      setState(() => _error = l10n.failedToSend);
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final messages = ref.watch(chatMessagesProvider);
    return AppScaffold(
      title: l10n.bayadSupport,
      currentIndex: 2,
      child: Column(
        children: [
          MaterialBanner(
            content: Text(l10n.connectionFallback),
            leading: const Icon(Icons.lock_outline, color: AppColors.green),
            actions: [TextButton(onPressed: _refresh, child: Text(l10n.retry))],
          ),
          Expanded(
            child: messages.when(
              loading: () => LoadingView(message: l10n.splashLoading),
              error: (error, _) => ErrorView(message: l10n.unknownError, retryLabel: l10n.retry, onRetry: _refresh),
              data: (rows) => RefreshIndicator(
                onRefresh: _refresh,
                child: rows.isEmpty
                    ? ListView(
                        padding: const EdgeInsets.all(24),
                        children: [const SizedBox(height: 120), Icon(Icons.chat_bubble_outline, size: 48, color: AppColors.green), const SizedBox(height: 12), Center(child: Text(l10n.noMessagesYet, style: const TextStyle(fontWeight: FontWeight.w900))), Center(child: Text(l10n.startConversation))],
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: rows.length,
                        separatorBuilder: (context, index) => const SizedBox(height: 10),
                        itemBuilder: (context, index) => _MessageBubble(message: rows[index]),
                      ),
              ),
            ),
          ),
          if (_error != null) Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Text(_error!, style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w800))),
          _Composer(
            controller: _controller,
            attachment: _attachment,
            isSending: _isSending,
            onPickAttachment: _pickAttachment,
            onRemoveAttachment: () => setState(() => _attachment = null),
            onShareCard: _shareCard,
            onSend: _send,
          ),
        ],
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final isMine = message.senderType == 'customer';
    return Align(
      alignment: isMine ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 320),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isMine ? AppColors.green.withValues(alpha: 0.12) : Colors.white,
          border: Border.all(color: isMine ? AppColors.green.withValues(alpha: 0.35) : AppColors.border),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (message.messageType == 'customer_card' && message.cardSnapshot != null)
              _CustomerCard(snapshot: message.cardSnapshot!)
            else ...[
              if (message.body.isNotEmpty) Text(message.body),
              for (final attachment in message.attachments) _AttachmentTile(attachment: attachment),
            ],
            const SizedBox(height: 6),
            Text(
              '${message.createdAt == null ? '' : intl.DateFormat('HH:mm').format(message.createdAt!.toLocal())} · ${isMine && message.adminReadAt != null ? l10n.read : l10n.sent}',
              style: const TextStyle(fontSize: 12, color: AppColors.mutedText),
            ),
          ],
        ),
      ),
    );
  }
}

class _CustomerCard extends StatelessWidget {
  const _CustomerCard({required this.snapshot});

  final CustomerCardSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(l10n.shareCustomerCard, style: const TextStyle(fontWeight: FontWeight.w900)),
        const SizedBox(height: 8),
        Text(snapshot.customerName, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
        Directionality(textDirection: TextDirection.ltr, child: Text(snapshot.customerCode)),
        Text('${l10n.customerType}: ${snapshot.customerType}'),
        Directionality(textDirection: TextDirection.ltr, child: Text(snapshot.phone)),
        Directionality(textDirection: TextDirection.ltr, child: Text(snapshot.email)),
      ],
    );
  }
}

class _AttachmentTile extends StatelessWidget {
  const _AttachmentTile({required this.attachment});

  final ChatAttachment attachment;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final label = attachment.attachmentType == 'image' ? l10n.image : l10n.document;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        children: [
          Icon(attachment.attachmentType == 'image' ? Icons.image_outlined : Icons.picture_as_pdf_outlined, color: AppColors.green),
          const SizedBox(width: 8),
          Expanded(child: Text('$label · ${attachment.originalFilename}', overflow: TextOverflow.ellipsis)),
        ],
      ),
    );
  }
}

class _Composer extends StatelessWidget {
  const _Composer({
    required this.controller,
    required this.attachment,
    required this.isSending,
    required this.onPickAttachment,
    required this.onRemoveAttachment,
    required this.onShareCard,
    required this.onSend,
  });

  final TextEditingController controller;
  final PlatformFile? attachment;
  final bool isSending;
  final VoidCallback onPickAttachment;
  final VoidCallback onRemoveAttachment;
  final VoidCallback onShareCard;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.bankCardWarning, style: const TextStyle(color: AppColors.mutedText, fontSize: 12)),
            const SizedBox(height: 8),
            TextField(
              controller: controller,
              minLines: 1,
              maxLines: 4,
              decoration: InputDecoration(hintText: l10n.typeAMessage, suffixIcon: IconButton(onPressed: isSending ? null : onSend, icon: const Icon(Icons.send))),
            ),
            const SizedBox(height: 8),
            if (attachment != null)
              InputChip(label: Text(attachment!.name), onDeleted: onRemoveAttachment),
            Row(
              children: [
                IconButton(onPressed: isSending ? null : onPickAttachment, icon: const Icon(Icons.attach_file), tooltip: l10n.attachFile),
                IconButton(onPressed: isSending ? null : onShareCard, icon: const Icon(Icons.badge_outlined), tooltip: l10n.shareCustomerCard),
                const Spacer(),
                FilledButton(
                  style: FilledButton.styleFrom(minimumSize: const Size(88, 44)),
                  onPressed: isSending ? null : onSend,
                  child: Text(isSending ? l10n.sending : l10n.send),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
