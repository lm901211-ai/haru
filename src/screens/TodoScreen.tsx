import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, DateNav, DeleteX, Empty, Input, Screen, styles } from '../components/ui';
import { useStore } from '../store';
import { formatKey, todayKey } from '../date';
import { colors } from '../theme';
import { Todo } from '../types';

export default function TodoScreen() {
  const { data, addTodo, updateTodo, deleteTodo } = useStore();
  const [date, setDate] = useState(todayKey());
  const [title, setTitle] = useState('');
  const today = todayKey();

  const sortTodos = (a: Todo, b: Todo) => Number(a.done) - Number(b.done) || Number(b.important) - Number(a.important);
  const todos = data.todos.filter((t) => t.date === date).sort(sortTodos);
  const overdue = date === today ? data.todos.filter((t) => !t.done && t.date < today) : [];
  const doneCount = todos.filter((t) => t.done).length;

  const submit = () => {
    if (!title.trim()) return;
    addTodo(title.trim(), date);
    setTitle('');
  };

  return (
    <Screen title="할 일">
      <DateNav date={date} onChange={setDate} />

      <Card>
        <View style={styles.row}>
          <Input value={title} onChangeText={setTitle} placeholder="할 일을 입력하세요" onSubmitEditing={submit} returnKeyType="done" style={{ flex: 1 }} />
          <Button label="추가" onPress={submit} />
        </View>
      </Card>

      {overdue.length > 0 && (
        <Card title="⏰ 밀린 일" right={<Button label="모두 오늘로" small outline color={colors.danger} onPress={() => overdue.forEach((t) => updateTodo(t.id, { date: today }))} />}>
          {overdue.map((t) => (
            <View key={t.id} style={styles.listItem}>
              <Text style={{ flex: 1, fontSize: 15, color: colors.text }}>{t.title}</Text>
              <Text style={styles.muted}>{formatKey(t.date)}</Text>
              <Button label="오늘로" small outline onPress={() => updateTodo(t.id, { date: today })} />
            </View>
          ))}
        </Card>
      )}

      <Card title="목록" right={<Text style={styles.muted}>{doneCount} / {todos.length} 완료</Text>}>
        {todos.length === 0 && <Empty text="할 일이 없어요. 위에서 추가해 보세요!" />}
        {todos.map((t) => (
          <TodoRow
            key={t.id}
            todo={t}
            onToggle={() => updateTodo(t.id, { done: !t.done })}
            onStar={() => updateTodo(t.id, { important: !t.important })}
            onDelete={() => deleteTodo(t.id)}
          />
        ))}
      </Card>
    </Screen>
  );
}

export function TodoRow({ todo, onToggle, onStar, onDelete }: { todo: Todo; onToggle: () => void; onStar?: () => void; onDelete?: () => void }) {
  return (
    <View style={styles.listItem}>
      <Pressable onPress={onToggle} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            borderWidth: 2,
            borderColor: todo.done ? colors.primary : colors.line,
            backgroundColor: todo.done ? colors.primary : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {todo.done && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>✓</Text>}
        </View>
        <Text style={{ flex: 1, fontSize: 15, color: todo.done ? colors.sub : colors.text, textDecorationLine: todo.done ? 'line-through' : 'none' }}>
          {todo.title}
        </Text>
      </Pressable>
      {onStar && (
        <Pressable onPress={onStar} hitSlop={8}>
          <Text style={{ fontSize: 18, color: todo.important ? colors.star : colors.line }}>★</Text>
        </Pressable>
      )}
      {onDelete && <DeleteX onPress={onDelete} />}
    </View>
  );
}
