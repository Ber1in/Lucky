from __future__ import annotations


def _seed(make_draw):
    make_draw("26014", front=(1, 2, 3, 4, 5), back=(1, 2))
    make_draw("26013", front=(1, 2, 3, 4, 6), back=(1, 3))
    make_draw("26012", front=(7, 8, 9, 10, 11), back=(4, 5))


def test_frequency_and_omission(client, make_draw):
    _seed(make_draw)
    response = client.get("/api/insights/numbers?window=all")
    assert response.status_code == 200
    body = response.json()
    assert body["sample_size"] == 3
    assert body["window"] == "all"

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
    body = client.get("/api/insights/numbers?window=all").json()
    counts = [item["count"] for item in body["front"]]
    assert counts == sorted(counts, reverse=True)


def test_last100_window(client, make_draw):
    for number in range(26000, 26105):
        make_draw(str(number), front=(1, 2, 3, 4, 5 + 0), back=(1, 2))
    body = client.get("/api/insights/numbers?window=last100").json()
    assert body["sample_size"] == 100


def test_last1y_window(client, make_draw):
    from datetime import date, timedelta

    make_draw("26014", draw_date=date.today() - timedelta(days=30))
    make_draw("26013", draw_date=date.today() - timedelta(days=400))
    body = client.get("/api/insights/numbers?window=last1y").json()
    assert body["sample_size"] == 1


def test_invalid_window(client):
    response = client.get("/api/insights/numbers?window=last7")
    assert response.status_code == 422
