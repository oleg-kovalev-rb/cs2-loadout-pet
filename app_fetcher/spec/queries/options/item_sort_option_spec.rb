require "rails_helper"

RSpec.describe Options::ItemSortOption do
  describe "#apply" do
    let!(:high_percent) do
      create(:item, market_hash_name: "Sort | A", current_price_cents: 100, change_24h_cents: 50)
    end
    let!(:big_amount) do
      create(:item, market_hash_name: "Sort | B", current_price_cents: 1000, change_24h_cents: 300)
    end
    let!(:mid_percent) do
      create(:item, market_hash_name: "Sort | C", current_price_cents: 1000, change_24h_cents: -200)
    end
    let!(:low_percent) do
      create(:item, market_hash_name: "Sort | D", current_price_cents: 100, change_24h_cents: -10)
    end

    let(:scope) do
      Item.where(id: [ high_percent.id, big_amount.id, mid_percent.id, low_percent.id ])
    end

    it "ChangeAmountDesc orders by absolute change in cents descending, ignoring sign" do
      expect(described_class::ChangeAmountDesc.apply(scope).to_a).to eq(
        [ big_amount, mid_percent, high_percent, low_percent ]
      )
    end

    it "ChangeAmountAsc orders by absolute change in cents ascending, ignoring sign" do
      expect(described_class::ChangeAmountAsc.apply(scope).to_a).to eq(
        [ low_percent, high_percent, mid_percent, big_amount ]
      )
    end

    it "ChangePercentDesc orders by absolute percent change descending" do
      expect(described_class::ChangePercentDesc.apply(scope).to_a).to eq(
        [ high_percent, big_amount, mid_percent, low_percent ]
      )
    end

    it "ChangePercentAsc orders by absolute percent change ascending" do
      expect(described_class::ChangePercentAsc.apply(scope).to_a).to eq(
        [ low_percent, mid_percent, big_amount, high_percent ]
      )
    end

    it "resolves the legacy ChangeDesc alias to ChangePercentDesc" do
      expect(described_class::ChangeDesc.apply(scope).to_a).to eq(
        described_class::ChangePercentDesc.apply(scope).to_a
      )
    end

    it "breaks equal magnitudes by market_hash_name" do
      bravo = create(:item, market_hash_name: "Sort | Bravo", current_price_cents: 100, change_24h_cents: -100)
      alpha = create(:item, market_hash_name: "Sort | Alpha", current_price_cents: 100, change_24h_cents: 100)
      tie_scope = Item.where(id: [ bravo.id, alpha.id ])

      expect(described_class::ChangeAmountDesc.apply(tie_scope).to_a).to eq([ alpha, bravo ])
    end

    it "treats a missing change as zero so it sorts after non-zero magnitudes" do
      missing = create(:item, current_price_cents: 100, change_24h_cents: nil)
      changed = create(:item, current_price_cents: 100, change_24h_cents: 10)
      null_scope = Item.where(id: [ missing.id, changed.id ])

      expect(described_class::ChangeAmountDesc.apply(null_scope).to_a).to eq([ changed, missing ])
    end

    it "treats a zero-price percent as zero instead of sorting it first" do
      zero_price = create(:item, current_price_cents: 0, change_24h_cents: 0)
      unpriced = create(:item, :without_price)
      changed = create(:item, current_price_cents: 100, change_24h_cents: 10)
      zero_scope = Item.where(id: [ zero_price.id, unpriced.id, changed.id ])

      ordered = described_class::ChangePercentDesc.apply(zero_scope).to_a

      aggregate_failures do
        expect(ordered.first).to eq(changed)
        expect(ordered.drop(1)).to contain_exactly(zero_price, unpriced)
      end
    end

    it "PriceDesc orders by current_price_cents descending" do
      cheap = create(:item, current_price_cents: 100)
      expensive = create(:item, current_price_cents: 900)
      scope = Item.where(id: [ cheap.id, expensive.id ])

      expect(described_class::PriceDesc.apply(scope).to_a).to eq([ expensive, cheap ])
    end

    it "PriceAsc orders by current_price_cents ascending" do
      cheap = create(:item, current_price_cents: 100)
      expensive = create(:item, current_price_cents: 900)
      scope = Item.where(id: [ cheap.id, expensive.id ])

      expect(described_class::PriceAsc.apply(scope).to_a).to eq([ cheap, expensive ])
    end

    it "NameAsc orders by metadata item_name ascending via raw SQL" do
      bravo = create(:item, metadata: { item_name: "Bravo" })
      alpha = create(:item, metadata: { item_name: "Alpha" })
      scope = Item.where(id: [ bravo.id, alpha.id ])

      expect(described_class::NameAsc.apply(scope).to_a).to eq([ alpha, bravo ])
    end
  end
end
