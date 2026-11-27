from __future__ import annotations

from datetime import date, timedelta


def _seed(make_draw):
    today = date.today()
    make_draw("26135", front=(1, 2, 3, 4, 5), back=(1, 2), draw_date=today - timedelta(days=5))
    make_draw("25100", front=(1, 2, 3, 4, 6), back=(1, 3), draw_date=today - timedelta(days=60))
    make_draw("23001", front=(7, 8, 9, 10, 11), back=(4, 5), draw_date=today - timedelta(days=800))
    make_draw("18001", front=(12, 13, 14, 15, 16), back=(6, 7), draw_date=today - timedelta(days=3000))


def test_default_only_seven_tier(client, make_draw):
    _seed(make_draw)
    body = client.get("/api/insights/numbers").json()
    assert body["window"] == "1y"
    assert body["sample_size"] == 1


def test_include_nine_tier(client, make_draw):
    _seed(make_draw)
    body = client.get("/api/insights/numbers?window=1y&include_nine_tier=true").json()
    assert body["sample_size"] == 2


def test_include_nine_tier_3y(client, make_draw):
    _seed(make_draw)
    body = client.get("/api/insights/numbers?window=3y&include_nine_tier=true").json()
    assert body["sample_size"] == 3


def test_include_six_tier_filter(client, make_draw):
    today = date.today()
    make_draw("26135", draw_date=today - timedelta(days=5))
    make_draw("18001", draw_date=today - timedelta(days=10))

    assert client.get("/api/insights/numbers?window=1m").json()["sample_size"] == 1
    assert (
        client.get("/api/insights/numbers?window=1m&include_six_tier=true").json()["sample_size"]
        == 2
    )


def test_windows(client, make_draw):
    today = date.today()
    for draw_no, days in [("26135", 5), ("26130", 40), ("26100", 200), ("26050", 800)]:
        make_draw(draw_no, draw_date=today - timedelta(days=days))

    assert client.get("/api/insights/numbers?window=1m").json()["sample_size"] == 1
    assert client.get("/api/insights/numbers?window=3m").json()["sample_size"] == 2
    assert client.get("/api/insights/numbers?window=1y").json()["sample_size"] == 3
    assert client.get("/api/insights/numbers?window=3y").json()["sample_size"] == 4


def test_frequency_and_omission(client, make_draw):
    today = date.today()
    make_draw("26135", front=(1, 2, 3, 4, 5), back=(1, 2), draw_date=today - timedelta(days=5))
    make_draw("26130", front=(1, 2, 3, 4, 6), back=(1, 3), draw_date=today - timedelta(days=20))
    make_draw("26100", front=(7, 8, 9, 10, 11), back=(4, 5), draw_date=today - timedelta(days=60))

    body = client.get("/api/insights/numbers?window=1y").json()
    assert body["sample_size"] == 3

    front = {item["number"]: item for item in body["front"]}
    assert front[1]["count"] == 2
    assert front[1]["omission"] == 0
    assert front[7]["count"] == 1
    assert front[7]["omission"] == 2
    assert front[35]["count"] == 0
    assert front[35]["omission"] is None

    back = {item["number"]: item for item in body["back"]}
    assert back[1]["count"] == 2
    assert back[2]["count"] == 1


def test_sorted_by_count_desc(client, make_draw):
    _seed(make_draw)
    body = client.get("/api/insights/numbers?window=3y&include_nine_tier=true").json()
    counts = [item["count"] for item in body["front"]]
    assert counts == sorted(counts, reverse=True)


def test_invalid_window(client):
    response = client.get("/api/insights/numbers?window=all")
    assert response.status_code == 422
