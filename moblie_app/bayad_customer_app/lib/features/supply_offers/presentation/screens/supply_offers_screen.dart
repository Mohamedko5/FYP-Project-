import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/routing/route_names.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../shared/data/mobile_providers.dart';
import '../../../../shared/data/mobile_repository.dart';
import '../../../../shared/models/mobile_models.dart';
import '../../../../shared/widgets/app_scaffold.dart';
import '../../../../shared/widgets/bayad_design_system.dart';
import '../../../../shared/widgets/empty_view.dart';
import '../../../../shared/widgets/error_view.dart';
import '../../../../shared/widgets/loading_view.dart';
import '../../../../shared/widgets/customer_widgets.dart';
import '../../data/models/supply_offer_models.dart';

class SupplyOffersScreen extends ConsumerWidget {
  const SupplyOffersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final offers = ref.watch(supplyOffersProvider);
    return AppScaffold(
      title: l10n.supplyOffers,
      currentIndex: 0,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () => context.goNamed(RouteNames.createSupplyOffer),
                icon: const Icon(Icons.agriculture_outlined),
                label: Text(l10n.sellToBayad),
              ),
            ),
          ),
          Expanded(
            child: offers.when(
              loading: () => LoadingView(message: l10n.loadingSupplyOffers),
              error: (error, _) => ErrorView(
                message: l10n.supplyOfferLoadError,
                retryLabel: l10n.retry,
                onRetry: () => ref.invalidate(supplyOffersProvider),
              ),
              data: (page) {
                if (page.results.isEmpty) {
                  return EmptyView(message: l10n.noSupplyOffers);
                }
                return RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(homeSummaryProvider);
                    return ref.refresh(supplyOffersProvider.future);
                  },
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 104),
                    itemCount: page.results.length,
                    separatorBuilder: (context, index) =>
                        const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final offer = page.results[index];
                      return BayadCard(
                        onTap: () => context.goNamed(
                          RouteNames.supplyOfferDetail,
                          pathParameters: {'id': offer.id.toString()},
                        ),
                        child: InkWell(
                          onTap: () => context.goNamed(
                            RouteNames.supplyOfferDetail,
                            pathParameters: {'id': offer.id.toString()},
                          ),
                          child: Padding(
                            padding: EdgeInsets.zero,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        offer.offerNumber.isEmpty
                                            ? l10n.draft
                                            : offer.offerNumber,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w900,
                                        ),
                                      ),
                                    ),
                                    if (offer.hasUnreadResponse)
                                      Chip(label: Text(l10n.newAdminResponse)),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  '${offer.productSummary}\n${offer.city} - ${offer.region}\n${_statusLabel(l10n, offer.status)}',
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  '${l10n.originalTotal}: ${formatMoney(offer.proposedTotal, offer.currency)}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                if (offer.currentResponse != null) ...[
                                  Text(
                                    '${l10n.adminProposedTotal}: ${formatMoney(offer.currentResponse!.proposedTotal, offer.currency)}',
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  if (offer.latestAdminMessage.isNotEmpty)
                                    Text(offer.latestAdminMessage),
                                  const SizedBox(height: 8),
                                  Align(
                                    alignment: AlignmentDirectional.centerEnd,
                                    child: OutlinedButton(
                                      onPressed: () => context.goNamed(
                                        RouteNames.supplyOfferDetail,
                                        pathParameters: {
                                          'id': offer.id.toString(),
                                        },
                                      ),
                                      child: Text(l10n.reviewAdminOffer),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class SupplyOfferDetailScreen extends ConsumerWidget {
  const SupplyOfferDetailScreen({super.key, required this.offerId});

  final int offerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final offer = ref.watch(supplyOfferDetailProvider(offerId));
    return AppScaffold(
      title: l10n.offerDetails,
      currentIndex: 0,
      child: offer.when(
        loading: () => LoadingView(message: l10n.loadingSupplyOffers),
        error: (error, _) => ErrorView(
          message: l10n.supplyOfferLoadError,
          retryLabel: l10n.retry,
          onRetry: () => ref.invalidate(supplyOfferDetailProvider(offerId)),
        ),
        data: (offer) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            ref.invalidate(homeSummaryProvider);
            ref.invalidate(supplyOffersProvider);
          });
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(homeSummaryProvider);
              ref.invalidate(supplyOffersProvider);
              return ref.refresh(supplyOfferDetailProvider(offerId).future);
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 104),
              children: [
                Text(
                  offer.offerNumber,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                Chip(label: Text(_statusLabel(l10n, offer.status))),
                if (offer.adminMessage.isNotEmpty)
                  BayadCard(child: Text(offer.adminMessage)),
                if (offer.rejectionReason.isNotEmpty)
                  BayadCard(child: Text(offer.rejectionReason)),
                if (offer.currentResponse != null)
                  _AdminResponseCard(offer: offer),
                BayadCard(
                  child: ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(l10n.paymentStatus),
                    subtitle: Text(
                      offer.paymentStatus == 'paid'
                          ? l10n.paymentCompleted
                          : offer.status == 'customer_accepted'
                          ? l10n.waitingFinalApproval
                          : offer.paymentStatus,
                    ),
                    trailing: Text(
                      formatMoney(offer.paidAmount, offer.currency),
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  l10n.products,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                ...offer.items.map(
                  (item) => BayadCard(
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text('${item.productName} - ${item.unit}'),
                      subtitle: Text(
                        '${l10n.quantity}: ${item.quantity}\n${l10n.proposedUnitPrice}: ${formatMoney(item.customerPrice)}',
                      ),
                      trailing: Text(formatMoney(item.lineTotal)),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  l10n.productLocation,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                BayadCard(
                  child: Text(
                    '${offer.region}, ${offer.city}, ${offer.area}\n${offer.detailedAddress}',
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  l10n.offerStatusTimeline,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                ...offer.timeline.map(
                  (entry) => ListTile(
                    title: Text(_statusLabel(l10n, entry.status)),
                    subtitle: Text(entry.note),
                  ),
                ),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: () async {
                    await ref
                        .read(mobileRepositoryProvider)
                        .supplyOfferAction(offer.id, 'chat-card');
                    if (context.mounted) {
                      context.goNamed(RouteNames.chat);
                    }
                  },
                  icon: const Icon(Icons.chat_bubble_outline),
                  label: Text(l10n.chatAboutThisOffer),
                ),
                if (offer.status == 'counter_offered') ...[
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: () => _acceptOffer(context, ref, offer),
                    child: Text(l10n.acceptPrice),
                  ),
                  TextButton(
                    onPressed: () => _rejectOffer(context, ref, offer),
                    child: Text(l10n.declinePrice),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _acceptOffer(
    BuildContext context,
    WidgetRef ref,
    SupplyOffer offer,
  ) async {
    final response = offer.currentResponse;
    if (response == null) {
      return _offerAction(context, ref, offer.id, 'accept-counter-offer');
    }
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.acceptPrice),
        content: Text(l10n.reviewAdminOffer),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.cancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l10n.acceptPrice),
          ),
        ],
      ),
    );
    if (confirmed != true) {
      return;
    }
    if (!context.mounted) {
      return;
    }
    await _responseAction(context, ref, offer.id, response.id, 'accept');
  }

  Future<void> _rejectOffer(
    BuildContext context,
    WidgetRef ref,
    SupplyOffer offer,
  ) async {
    final response = offer.currentResponse;
    if (response == null) {
      return _offerAction(context, ref, offer.id, 'decline-counter-offer');
    }
    final controller = TextEditingController();
    final l10n = AppLocalizations.of(context);
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.declinePrice),
        content: TextField(
          controller: controller,
          decoration: InputDecoration(labelText: l10n.reasonForRejection),
          maxLines: 3,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(l10n.cancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(controller.text.trim()),
            child: Text(l10n.declinePrice),
          ),
        ],
      ),
    );
    controller.dispose();
    if (reason == null || reason.isEmpty) {
      return;
    }
    if (!context.mounted) {
      return;
    }
    await _responseAction(
      context,
      ref,
      offer.id,
      response.id,
      'reject',
      data: {'reason': reason},
    );
  }

  Future<void> _responseAction(
    BuildContext context,
    WidgetRef ref,
    int offerId,
    int responseId,
    String action, {
    Map<String, dynamic>? data,
  }) async {
    final messenger = ScaffoldMessenger.of(context);
    final l10n = AppLocalizations.of(context);
    try {
      await ref
          .read(mobileRepositoryProvider)
          .supplyOfferResponseAction(offerId, responseId, action, data: data);
      ref.invalidate(supplyOfferDetailProvider(offerId));
      ref.invalidate(supplyOffersProvider);
      messenger.showSnackBar(SnackBar(content: Text(l10n.saved)));
    } catch (_) {
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.supplyOfferSaveError)),
      );
    }
  }

  Future<void> _offerAction(
    BuildContext context,
    WidgetRef ref,
    int id,
    String action,
  ) async {
    final messenger = ScaffoldMessenger.of(context);
    final l10n = AppLocalizations.of(context);
    try {
      await ref.read(mobileRepositoryProvider).supplyOfferAction(id, action);
      ref.invalidate(supplyOfferDetailProvider(id));
      ref.invalidate(supplyOffersProvider);
      messenger.showSnackBar(SnackBar(content: Text(l10n.saved)));
    } catch (_) {
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.supplyOfferSaveError)),
      );
    }
  }
}

class _AdminResponseCard extends StatelessWidget {
  const _AdminResponseCard({required this.offer});

  final SupplyOffer offer;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final response = offer.currentResponse!;
    return BayadCard(
      child: Padding(
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l10n.adminResponse,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            if (response.message.isNotEmpty) Text(response.message),
            const SizedBox(height: 8),
            Text(
              '${l10n.originalTotal}: ${formatMoney(offer.proposedTotal, offer.currency)}',
            ),
            Text(
              '${l10n.adminProposedTotal}: ${formatMoney(response.proposedTotal, offer.currency)}',
            ),
            if (response.createdAt.isNotEmpty)
              Text('${l10n.responseDate}: ${response.createdAt}'),
            if (response.expiresAt.isNotEmpty)
              Text('${l10n.responseExpiry}: ${response.expiresAt}'),
            if (response.proposedReceiptDate.isNotEmpty)
              Text('${l10n.availabilityDate}: ${response.proposedReceiptDate}'),
            if (response.warehouseName.isNotEmpty)
              Text('${l10n.receivingWarehouse}: ${response.warehouseName}'),
            const Divider(),
            ...response.items.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  '${item.productName} - ${item.unit}\n${l10n.customerQuantity}: ${item.customerQuantity}\n${l10n.adminQuantity}: ${item.adminQuantity}\n${l10n.customerPrice}: ${formatMoney(item.customerPrice)}\n${l10n.adminPrice}: ${formatMoney(item.adminPrice)}',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class CreateSupplyOfferScreen extends ConsumerStatefulWidget {
  const CreateSupplyOfferScreen({super.key});

  @override
  ConsumerState<CreateSupplyOfferScreen> createState() =>
      _CreateSupplyOfferScreenState();
}

class _CreateSupplyOfferScreenState
    extends ConsumerState<CreateSupplyOfferScreen> {
  final _formKey = GlobalKey<FormState>();
  final _reference = TextEditingController();
  final _region = TextEditingController();
  final _city = TextEditingController();
  final _area = TextEditingController();
  final _address = TextEditingController();
  final _notes = TextEditingController();
  final List<_DraftOfferItem> _items = [_DraftOfferItem()];
  final List<PlatformFile> _attachments = [];
  bool _saving = false;

  @override
  void dispose() {
    _reference.dispose();
    _region.dispose();
    _city.dispose();
    _area.dispose();
    _address.dispose();
    _notes.dispose();
    for (final item in _items) {
      item.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final products = ref.watch(productsProvider);
    return AppScaffold(
      title: l10n.createSupplyOffer,
      currentIndex: 0,
      child: products.when(
        loading: () => LoadingView(message: l10n.loadingProducts),
        error: (error, _) => ErrorView(
          message: l10n.supplyOfferLoadError,
          retryLabel: l10n.retry,
          onRetry: () => ref.invalidate(productsProvider),
        ),
        data: (page) => Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 104),
            children: [
              Text(
                l10n.addOfferItems,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              ...List.generate(
                _items.length,
                (index) => _ItemEditor(
                  item: _items[index],
                  products: page.results,
                  canRemove: _items.length > 1,
                  onRemove: () => setState(() => _items.removeAt(index)),
                ),
              ),
              OutlinedButton.icon(
                onPressed: () => setState(() => _items.add(_DraftOfferItem())),
                icon: const Icon(Icons.add),
                label: Text(l10n.addProduct),
              ),
              const SizedBox(height: 16),
              Text(
                l10n.productLocation,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              _field(_region, l10n.regionState, required: true),
              _field(_city, l10n.city, required: true),
              _field(_area, l10n.area),
              _field(
                _address,
                l10n.detailedAddress,
                required: true,
                maxLines: 2,
              ),
              _field(_reference, l10n.customerReference),
              _field(_notes, l10n.customerNotes, maxLines: 3),
              const SizedBox(height: 16),
              Text(
                l10n.uploadProductPhotos,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              OutlinedButton.icon(
                onPressed: _pickFiles,
                icon: const Icon(Icons.image_outlined),
                label: Text(l10n.chooseAttachment),
              ),
              ..._attachments.map(
                (file) => ListTile(
                  leading: const Icon(Icons.attach_file),
                  title: Text(file.name),
                  trailing: IconButton(
                    onPressed: () => setState(() => _attachments.remove(file)),
                    icon: const Icon(Icons.close),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                l10n.reviewOffer,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              BayadCard(
                child: Padding(
                  padding: EdgeInsets.zero,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${l10n.proposedTotal}: ${formatMoney(_previewTotal())}',
                        style: const TextStyle(fontWeight: FontWeight.w900),
                      ),
                      const SizedBox(height: 8),
                      Text(l10n.supplyOfferNotice),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: _saving ? null : () => _submit(page.results),
                icon: const Icon(Icons.send_outlined),
                label: Text(_saving ? l10n.sending : l10n.submitOffer),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    bool required = false,
    int maxLines = 1,
  }) {
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: TextFormField(
        controller: controller,
        maxLines: maxLines,
        decoration: InputDecoration(labelText: label),
        validator: required
            ? (value) => (value == null || value.trim().isEmpty)
                  ? AppLocalizations.of(context).requiredField
                  : null
            : null,
      ),
    );
  }

  Future<void> _pickFiles() async {
    final result = await FilePicker.platform.pickFiles(
      allowMultiple: true,
      type: FileType.custom,
      allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    );
    if (result != null) {
      setState(
        () => _attachments.addAll(
          result.files.where((file) => file.path != null),
        ),
      );
    }
  }

  double _previewTotal() => _items.fold(
    0,
    (sum, item) =>
        sum +
        ((double.tryParse(item.quantity.text) ?? 0) *
            (double.tryParse(item.price.text) ?? 0)),
  );

  Future<void> _submit(List<Product> products) async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    if (!_formKey.currentState!.validate()) {
      return;
    }
    final payloadItems = <Map<String, dynamic>>[];
    final seen = <String>{};
    for (final item in _items) {
      Product? product;
      ProductUnitOption? unit;
      for (final candidate in products) {
        if (candidate.id == item.productId) {
          product = candidate;
          break;
        }
      }
      if (product != null) {
        for (final candidate in product.units) {
          if (candidate.id == item.unitId) {
            unit = candidate;
            break;
          }
        }
      }
      if (product == null || unit == null) {
        messenger.showSnackBar(SnackBar(content: Text(l10n.productRequired)));
        return;
      }
      final key = '${product.id}-${unit.id}';
      if (seen.contains(key)) {
        messenger.showSnackBar(
          SnackBar(content: Text(l10n.duplicateProductUnit)),
        );
        return;
      }
      seen.add(key);
      payloadItems.add({
        'product_id': product.id,
        'product_unit_id': unit.id,
        'quantity': item.quantity.text,
        'proposed_unit_price': item.price.text,
        'quality_grade': item.quality.text,
        'packaging_details': item.packaging.text,
      });
    }
    setState(() => _saving = true);
    try {
      final offer = await ref
          .read(mobileRepositoryProvider)
          .createSupplyOffer(
            idempotencyKey: DateTime.now().microsecondsSinceEpoch.toString(),
            data: {
              'customer_reference': _reference.text,
              'region': _region.text,
              'city': _city.text,
              'area': _area.text,
              'detailed_address': _address.text,
              'customer_notes': _notes.text,
              'items': payloadItems,
            },
          );
      for (final file in _attachments) {
        await ref
            .read(mobileRepositoryProvider)
            .uploadSupplyOfferAttachment(offer.id, file.path!, file.name);
      }
      final submitted = await ref
          .read(mobileRepositoryProvider)
          .supplyOfferAction(offer.id, 'submit');
      ref.invalidate(supplyOffersProvider);
      if (mounted) {
        context.goNamed(
          RouteNames.supplyOfferDetail,
          pathParameters: {'id': submitted.id.toString()},
        );
      }
    } catch (_) {
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.supplyOfferSaveError)),
      );
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }
}

class _DraftOfferItem {
  int? productId;
  int? unitId;
  final quantity = TextEditingController();
  final price = TextEditingController();
  final quality = TextEditingController();
  final packaging = TextEditingController();

  void dispose() {
    quantity.dispose();
    price.dispose();
    quality.dispose();
    packaging.dispose();
  }
}

class _ItemEditor extends StatefulWidget {
  const _ItemEditor({
    required this.item,
    required this.products,
    required this.canRemove,
    required this.onRemove,
  });

  final _DraftOfferItem item;
  final List<Product> products;
  final bool canRemove;
  final VoidCallback onRemove;

  @override
  State<_ItemEditor> createState() => _ItemEditorState();
}

class _ItemEditorState extends State<_ItemEditor> {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    Product? selectedProduct;
    for (final product in widget.products) {
      if (product.id == widget.item.productId) {
        selectedProduct = product;
        break;
      }
    }
    final units = selectedProduct?.units ?? const <ProductUnitOption>[];
    return BayadCard(
      child: Padding(
        padding: EdgeInsets.zero,
        child: Column(
          children: [
            DropdownButtonFormField<int>(
              initialValue: widget.item.productId,
              decoration: InputDecoration(labelText: l10n.product),
              items: widget.products
                  .map(
                    (product) => DropdownMenuItem(
                      value: product.id,
                      child: Text(
                        product.localizedName(
                          Directionality.of(context) == TextDirection.rtl,
                        ),
                      ),
                    ),
                  )
                  .toList(),
              onChanged: (value) => setState(() {
                widget.item.productId = value;
                widget.item.unitId = null;
              }),
              validator: (value) => value == null ? l10n.productRequired : null,
            ),
            const SizedBox(height: 10),
            DropdownButtonFormField<int>(
              initialValue: widget.item.unitId,
              decoration: InputDecoration(labelText: l10n.unit),
              items: units
                  .map(
                    (unit) => DropdownMenuItem(
                      value: unit.id,
                      child: Text(unit.unit),
                    ),
                  )
                  .toList(),
              onChanged: (value) => setState(() => widget.item.unitId = value),
              validator: (value) => value == null ? l10n.requiredField : null,
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: widget.item.quantity,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(labelText: l10n.quantity),
              validator: _positive,
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: widget.item.price,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(labelText: l10n.proposedUnitPrice),
              validator: _positive,
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: widget.item.quality,
              decoration: InputDecoration(labelText: l10n.qualityGrade),
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: widget.item.packaging,
              decoration: InputDecoration(labelText: l10n.packagingDetails),
            ),
            if (widget.canRemove)
              TextButton.icon(
                onPressed: widget.onRemove,
                icon: const Icon(Icons.delete_outline),
                label: Text(l10n.remove),
              ),
          ],
        ),
      ),
    );
  }

  String? _positive(String? value) {
    final parsed = double.tryParse(value ?? '');
    if (parsed == null || parsed <= 0) {
      return AppLocalizations.of(context).positiveNumberRequired;
    }
    return null;
  }
}

String _statusLabel(AppLocalizations l10n, String status) {
  return switch (status) {
    'draft' => l10n.draft,
    'submitted' => l10n.submitted,
    'under_review' => l10n.underReview,
    'counter_offered' => l10n.adminResponded,
    'customer_accepted' => l10n.customerAccepted,
    'customer_declined' => l10n.customerDeclined,
    'approved' => l10n.approved,
    'rejected' => l10n.rejected,
    'awaiting_receipt' => l10n.awaitingProductReceipt,
    'paid' => l10n.paymentCompleted,
    'received' => l10n.received,
    'completed' => l10n.completed,
    _ => status,
  };
}
